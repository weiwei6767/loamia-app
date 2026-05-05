"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeNextRun, type Recurrence } from "@/lib/scheduler";

export type ScheduleState = undefined | { error: string } | { success: true };

// ── Scheduled posts (one-time) ──────────────────────

export async function createScheduledPost(
  _state: ScheduleState,
  formData: FormData
): Promise<ScheduleState> {
  const brandId = String(formData.get("brandId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
  if (!brandId || !text || !scheduledAtRaw) return { error: "缺少欄位" };
  if (text.length > 500) return { error: "Threads 貼文最多 500 字" };

  const scheduledAt = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledAt.getTime())) return { error: "時間格式錯誤" };
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    return { error: "排程時間不能在過去" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在" };

  const { error } = await supabase.from("scheduled_posts").insert({
    agency_id: brand.agency_id,
    brand_id: brand.id,
    user_id: user.id,
    platform: "threads",
    text,
    scheduled_at: scheduledAt.toISOString(),
    status: "pending",
  });
  if (error) return { error: error.message };

  revalidatePath(`/brand/${brandId}/schedule`);
  return { success: true };
}

export async function cancelScheduledPost(postId: string, brandId: string) {
  const supabase = await createClient();
  await supabase
    .from("scheduled_posts")
    .update({ status: "cancelled" })
    .eq("id", postId)
    .eq("status", "pending");
  revalidatePath(`/brand/${brandId}/schedule`);
}

export async function deleteScheduledPost(postId: string, brandId: string) {
  const supabase = await createClient();
  await supabase.from("scheduled_posts").delete().eq("id", postId);
  revalidatePath(`/brand/${brandId}/schedule`);
}

// ── Bulk create (multiple posts at once) ────────────

export type BulkScheduleState =
  | undefined
  | { error: string }
  | { success: true; count: number };

export async function bulkCreateScheduledPosts(
  _state: BulkScheduleState,
  formData: FormData
): Promise<BulkScheduleState> {
  const brandId = String(formData.get("brandId") ?? "");
  const blob = String(formData.get("blob") ?? "").trim();
  if (!brandId || !blob) return { error: "請貼上多筆貼文（每筆用 ===POST=== 分隔）" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在" };

  // Format expected: each "post" block separated by ===POST===
  // Each block has first line = ISO datetime, then post text.
  const blocks = blob
    .split(/\n*===POST===\n*/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return { error: "沒有解析到任何貼文" };

  const rows: Array<{
    agency_id: string;
    brand_id: string;
    user_id: string;
    platform: string;
    text: string;
    scheduled_at: string;
    status: string;
  }> = [];
  const errors: string[] = [];

  blocks.forEach((block, idx) => {
    const lines = block.split(/\r?\n/);
    const firstLine = lines.shift()?.trim() ?? "";
    const text = lines.join("\n").trim();
    const dt = new Date(firstLine);
    if (Number.isNaN(dt.getTime())) {
      errors.push(`第 ${idx + 1} 筆：時間格式錯誤「${firstLine}」`);
      return;
    }
    if (!text) {
      errors.push(`第 ${idx + 1} 筆：沒有貼文內容`);
      return;
    }
    if (text.length > 500) {
      errors.push(`第 ${idx + 1} 筆：超過 500 字`);
      return;
    }
    rows.push({
      agency_id: brand.agency_id as string,
      brand_id: brand.id as string,
      user_id: user.id,
      platform: "threads",
      text,
      scheduled_at: dt.toISOString(),
      status: "pending",
    });
  });

  if (rows.length === 0) {
    return { error: errors.join("\n") || "沒有可建立的貼文" };
  }

  const { error } = await supabase.from("scheduled_posts").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/brand/${brandId}/schedule`);
  if (errors.length > 0) {
    return { error: `已建立 ${rows.length} 筆，但以下失敗：\n${errors.join("\n")}` };
  }
  return { success: true, count: rows.length };
}

// ── Templates (recurring) ───────────────────────────

export async function createPostTemplate(
  _state: ScheduleState,
  formData: FormData
): Promise<ScheduleState> {
  const brandId = String(formData.get("brandId") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const prompt = String(formData.get("prompt") ?? "").trim().slice(0, 1500);
  const recurrenceRaw = String(formData.get("recurrence") ?? "");
  const weekdayRaw = String(formData.get("weekday") ?? "");
  const timeOfDay = String(formData.get("timeOfDay") ?? "").trim();

  if (!brandId || !name || !prompt || !timeOfDay) return { error: "缺少欄位" };
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeOfDay)) return { error: "時間格式 HH:MM" };
  const recurrence: Recurrence | null =
    recurrenceRaw === "daily" || recurrenceRaw === "weekly" ? recurrenceRaw : null;
  if (!recurrence) return { error: "請選擇 daily 或 weekly" };
  const weekday = recurrence === "weekly" ? parseInt(weekdayRaw || "1", 10) : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在" };

  const next = computeNextRun(new Date(), recurrence, timeOfDay, weekday);

  const { error } = await supabase.from("post_templates").insert({
    agency_id: brand.agency_id,
    brand_id: brand.id,
    user_id: user.id,
    name,
    prompt,
    recurrence,
    weekday,
    time_of_day: timeOfDay,
    next_run_at: next.toISOString(),
    active: true,
  });
  if (error) return { error: error.message };

  revalidatePath(`/brand/${brandId}/schedule`);
  return { success: true };
}

export async function toggleTemplateActive(templateId: string, active: boolean, brandId: string) {
  const supabase = await createClient();
  await supabase.from("post_templates").update({ active }).eq("id", templateId);
  revalidatePath(`/brand/${brandId}/schedule`);
}

export async function deletePostTemplate(templateId: string, brandId: string) {
  const supabase = await createClient();
  await supabase.from("post_templates").delete().eq("id", templateId);
  revalidatePath(`/brand/${brandId}/schedule`);
}
