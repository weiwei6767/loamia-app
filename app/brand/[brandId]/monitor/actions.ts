"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateMonitorReplies, generateOutreachReply } from "@/lib/ai/creative";
import { keywordSearch, createReply, findPostIdByUrl, type ThreadsPost } from "@/lib/threads/api";
import { recordWinningReplyFromMonitor } from "@/lib/ai/brand-brain";

const OUTREACH_DAILY_LIMIT = 30;
const OUTREACH_USERNAME_COOLDOWN_DAYS = 7;

export type MonitorState =
  | undefined
  | { error: string }
  | { success: true; replyId: string };

export async function generateReplies(
  _state: MonitorState,
  formData: FormData
): Promise<MonitorState> {
  const brandId = String(formData.get("brandId") ?? "");
  const sourceText = String(formData.get("sourceText") ?? "").trim();
  const sourceType = String(formData.get("sourceType") ?? "").trim();
  const tone = String(formData.get("tone") ?? "").trim();
  const threadsUrl = String(formData.get("threadsUrl") ?? "").trim();

  if (!brandId) return { error: "missing brandId" };
  if (!sourceText) return { error: "請貼上要回覆的內容" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在" };

  let suggestions: string[];
  try {
    const result = await generateMonitorReplies(brand.id, brand.name, sourceText, sourceType, tone);
    suggestions = result.suggestions;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "生成失敗" };
  }

  const { data: row, error: insertErr } = await supabase
    .from("monitor_replies")
    .insert({
      brand_id: brand.id,
      agency_id: brand.agency_id,
      user_id: user.id,
      source_text: sourceText,
      source_type: sourceType || null,
      tone: tone || null,
      suggestions,
      threads_url: threadsUrl || null,
    })
    .select("id")
    .single();
  if (insertErr || !row) return { error: insertErr?.message ?? "儲存失敗" };

  revalidatePath(`/brand/${brandId}/monitor`);
  return { success: true, replyId: row.id as string };
}

export async function deleteMonitorReply(replyId: string, brandId: string) {
  const supabase = await createClient();
  await supabase.from("monitor_replies").delete().eq("id", replyId);
  revalidatePath(`/brand/${brandId}/monitor`);
}

// ─── Threads API integrations ─────

export async function disconnectThreads(brandId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("social_connections")
    .delete()
    .eq("brand_id", brandId)
    .eq("platform", "threads");
  revalidatePath(`/brand/${brandId}/monitor`);
}

export type ThreadsSearchState =
  | undefined
  | { error: string }
  | { success: true; results: ThreadsPost[]; query: string };

export async function searchThreads(
  _state: ThreadsSearchState,
  formData: FormData
): Promise<ThreadsSearchState> {
  const brandId = String(formData.get("brandId") ?? "");
  const query = String(formData.get("query") ?? "").trim();
  const searchType = (String(formData.get("searchType") ?? "TOP") as "TOP" | "RECENT");

  if (!brandId) return { error: "missing brandId" };
  if (!query) return { error: "請輸入搜尋關鍵字" };

  const supabase = await createClient();
  const { data: conn } = await supabase
    .from("social_connections")
    .select("access_token")
    .eq("brand_id", brandId)
    .eq("platform", "threads")
    .single();
  if (!conn?.access_token) {
    return { error: "尚未連接 Threads，請先點上方連接" };
  }

  try {
    const results = await keywordSearch(conn.access_token, query, searchType);
    return { success: true, results, query };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "搜尋失敗" };
  }
}

export type ThreadsReplyState =
  | undefined
  | { error: string }
  | { success: true; replyId: string };

export async function postThreadsReply(
  _state: ThreadsReplyState,
  formData: FormData
): Promise<ThreadsReplyState> {
  const brandId = String(formData.get("brandId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const sourceReplyId = String(formData.get("sourceReplyId") ?? "").trim();
  const pickedIndexRaw = String(formData.get("pickedIndex") ?? "").trim();
  const pickedIndex = pickedIndexRaw ? parseInt(pickedIndexRaw, 10) : null;

  if (!brandId || !text || !url) return { error: "missing fields" };

  const supabase = await createClient();
  const { data: conn } = await supabase
    .from("social_connections")
    .select("access_token, platform_user_id")
    .eq("brand_id", brandId)
    .eq("platform", "threads")
    .single();
  if (!conn?.access_token || !conn?.platform_user_id) {
    return { error: "尚未連接 Threads" };
  }

  try {
    const replyToId = await findPostIdByUrl(conn.platform_user_id, conn.access_token, url);
    if (!replyToId) {
      return { error: "找不到此貼文（必須是你連接帳號的貼文）" };
    }
    const result = await createReply(
      conn.platform_user_id,
      conn.access_token,
      text,
      replyToId
    );

    // Feedback Loop: log the send event back to monitor_replies if traceable
    if (sourceReplyId) {
      await supabase
        .from("monitor_replies")
        .update({
          picked_index: pickedIndex,
          sent_text: text,
          sent_at: new Date().toISOString(),
          sent_platform: "threads",
          sent_to_id: result.id,
        })
        .eq("id", sourceReplyId);
    }

    return { success: true, replyId: result.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "發送失敗" };
  }
}

// ─── Outreach mode (semi-auto reply to public posts found via keyword search) ─────

export type OutreachStatus = {
  todaySent: number;
  dailyLimit: number;
  recentUsernames: string[]; // usernames replied within cooldown
};

export async function getOutreachStatus(brandId: string): Promise<OutreachStatus> {
  const supabase = await createClient();
  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);
  const cooldownStart = new Date(
    Date.now() - OUTREACH_USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  );

  const [{ count }, { data: recents }] = await Promise.all([
    supabase
      .from("outreach_log")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .gte("created_at", startOfTodayUtc.toISOString()),
    supabase
      .from("outreach_log")
      .select("target_username")
      .eq("brand_id", brandId)
      .gte("created_at", cooldownStart.toISOString())
      .not("target_username", "is", null),
  ]);

  const recentUsernames = Array.from(
    new Set(((recents ?? []) as { target_username: string }[]).map((r) => r.target_username))
  );

  return {
    todaySent: count ?? 0,
    dailyLimit: OUTREACH_DAILY_LIMIT,
    recentUsernames,
  };
}

export type OutreachGenerateResult =
  | { ok: true; reply: string }
  | { ok: false; error: string };

export async function generateOutreachReplyAction(
  brandId: string,
  post: { id: string; text?: string; username?: string },
  keyword: string
): Promise<OutreachGenerateResult> {
  if (!brandId || !post?.id) return { ok: false, error: "missing fields" };
  const supabase = await createClient();
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .single();
  if (!brand) return { ok: false, error: "brand not found" };

  try {
    const result = await generateOutreachReply(
      brand.id as string,
      brand.name as string,
      post.text ?? "",
      post.username ?? null,
      keyword
    );
    return { ok: true, reply: result.reply };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "AI 生成失敗" };
  }
}

export type OutreachSendResult =
  | { ok: true; replyId: string; todaySent: number }
  | { ok: false; error: string; reason?: "limit" | "cooldown" | "no_conn" | "fail" };

export async function sendOutreachReply(
  brandId: string,
  post: { id: string; permalink?: string; username?: string },
  replyText: string,
  keyword: string
): Promise<OutreachSendResult> {
  if (!brandId || !post?.id) return { ok: false, error: "missing fields", reason: "fail" };
  const text = replyText.trim().slice(0, 200);
  if (!text) return { ok: false, error: "留言內容不可為空", reason: "fail" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入", reason: "fail" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { ok: false, error: "品牌不存在", reason: "fail" };

  // Check daily limit
  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);
  const { count: todayCount } = await supabase
    .from("outreach_log")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .gte("created_at", startOfTodayUtc.toISOString());
  if ((todayCount ?? 0) >= OUTREACH_DAILY_LIMIT) {
    return {
      ok: false,
      error: `今日已達 ${OUTREACH_DAILY_LIMIT} 則上限，明天再試`,
      reason: "limit",
    };
  }

  // Check 7d username dedup
  if (post.username) {
    const cooldownStart = new Date(
      Date.now() - OUTREACH_USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );
    const { data: dup } = await supabase
      .from("outreach_log")
      .select("id")
      .eq("brand_id", brandId)
      .eq("target_username", post.username)
      .gte("created_at", cooldownStart.toISOString())
      .limit(1);
    if (dup && dup.length > 0) {
      return {
        ok: false,
        error: `7 天內已對 @${post.username} 回過，避免被視為 spam`,
        reason: "cooldown",
      };
    }
  }

  // Get Threads connection
  const { data: conn } = await supabase
    .from("social_connections")
    .select("access_token, platform_user_id")
    .eq("brand_id", brandId)
    .eq("platform", "threads")
    .single();
  if (!conn?.access_token || !conn?.platform_user_id) {
    return { ok: false, error: "尚未連接 Threads", reason: "no_conn" };
  }

  // Send the reply
  let replyId: string;
  try {
    const result = await createReply(
      conn.platform_user_id as string,
      conn.access_token as string,
      text,
      post.id
    );
    replyId = result.id;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "發送失敗",
      reason: "fail",
    };
  }

  // Log
  await supabase.from("outreach_log").insert({
    brand_id: brandId,
    agency_id: brand.agency_id,
    user_id: user.id,
    keyword: keyword.slice(0, 100),
    target_post_id: post.id,
    target_username: post.username ?? null,
    target_permalink: post.permalink ?? null,
    reply_text: text,
    reply_id: replyId,
  });

  revalidatePath(`/brand/${brandId}/monitor`);
  return { ok: true, replyId, todaySent: (todayCount ?? 0) + 1 };
}

// Mark outcome on a sent reply (replied / ignored / converted)
export async function markReplyOutcome(
  replyId: string,
  brandId: string,
  outcome: "replied" | "ignored" | "converted",
  note?: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("monitor_replies")
    .update({ outcome, outcome_note: note ?? null })
    .eq("id", replyId);

  // Feedback Loop → Winning Memory: convert successful replies into a brand pattern
  if (outcome === "converted") {
    const { data: row } = await supabase
      .from("monitor_replies")
      .select("id, brand_id, agency_id, sent_text, source_text, outcome, tone")
      .eq("id", replyId)
      .single();
    if (row) {
      await recordWinningReplyFromMonitor(supabase, {
        id: row.id as string,
        brand_id: row.brand_id as string,
        agency_id: row.agency_id as string,
        sent_text: (row.sent_text as string | null) ?? null,
        source_text: (row.source_text as string | null) ?? null,
        outcome: (row.outcome as string | null) ?? null,
        tone: (row.tone as string | null) ?? null,
      });
    }
  }

  revalidatePath(`/brand/${brandId}/monitor`);
}
