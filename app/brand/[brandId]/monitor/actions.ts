"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateMonitorReplies } from "@/lib/ai/creative";
import { keywordSearch, createReply, type ThreadsPost } from "@/lib/threads/api";

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
  const replyToId = String(formData.get("replyToId") ?? "").trim();

  if (!brandId || !text || !replyToId) return { error: "missing fields" };

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
    const result = await createReply(
      conn.platform_user_id,
      conn.access_token,
      text,
      replyToId
    );
    return { success: true, replyId: result.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "發送失敗" };
  }
}
