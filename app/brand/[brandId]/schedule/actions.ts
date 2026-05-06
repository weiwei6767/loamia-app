"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeNextRun, type Recurrence } from "@/lib/scheduler";
import { generateContentVariants } from "@/lib/ai/creative";

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

export async function quickSchedulePost(
  brandId: string,
  text: string,
  scheduledAtIso: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!brandId || !text.trim()) return { ok: false, error: "缺少內容或品牌" };
  if (text.length > 500) return { ok: false, error: "Threads 貼文最多 500 字" };

  const dt = new Date(scheduledAtIso);
  if (Number.isNaN(dt.getTime())) return { ok: false, error: "時間格式錯誤" };
  if (dt.getTime() < Date.now() - 60_000) return { ok: false, error: "排程時間不能在過去" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { ok: false, error: "品牌不存在" };

  const { error } = await supabase.from("scheduled_posts").insert({
    agency_id: brand.agency_id,
    brand_id: brand.id,
    user_id: user.id,
    platform: "threads",
    text: text.trim(),
    scheduled_at: dt.toISOString(),
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/brand/${brandId}/schedule`);
  return { ok: true };
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
  const intervalHoursRaw = String(formData.get("intervalHours") ?? "").trim();
  const tzOffsetMinutes = parseInt(String(formData.get("tzOffsetMinutes") ?? "0"), 10) || 0;

  const recurrence: Recurrence | null =
    recurrenceRaw === "daily" || recurrenceRaw === "weekly" || recurrenceRaw === "hourly"
      ? recurrenceRaw
      : null;
  if (!brandId || !name || !prompt) return { error: "缺少欄位" };
  if (!recurrence) return { error: "請選擇頻率" };

  let weekday: number | null = null;
  let intervalHours: number | null = null;
  let timeOfDayResolved = "00:00";

  if (recurrence === "hourly") {
    const n = parseInt(intervalHoursRaw, 10);
    if (Number.isNaN(n) || n < 1 || n > 24) return { error: "每 N 小時：N 需為 1–24" };
    intervalHours = n;
    timeOfDayResolved = "00:00"; // ignored for hourly but required by NOT NULL
  } else {
    if (!timeOfDay) return { error: "缺少時間" };
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeOfDay)) return { error: "時間格式 HH:MM" };
    timeOfDayResolved = timeOfDay;
    if (recurrence === "weekly") weekday = parseInt(weekdayRaw || "1", 10);
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

  const next = computeNextRun(
    new Date(),
    recurrence,
    timeOfDayResolved,
    weekday,
    tzOffsetMinutes,
    intervalHours
  );

  const { error } = await supabase.from("post_templates").insert({
    agency_id: brand.agency_id,
    brand_id: brand.id,
    user_id: user.id,
    name,
    prompt,
    recurrence,
    weekday,
    time_of_day: timeOfDayResolved,
    interval_hours: intervalHours,
    tz_offset_minutes: tzOffsetMinutes,
    next_run_at: next.toISOString(),
    active: true,
  });
  if (error) return { error: error.message };

  revalidatePath(`/brand/${brandId}/schedule`);
  return { success: true };
}

// Generate next-post content with AI and save as the locked version that will actually be sent
export type PreviewState =
  | undefined
  | { error: string }
  | { success: true; preview: string };

export async function previewTemplateContent(
  _state: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  const templateId = String(formData.get("templateId") ?? "");
  const brandId = String(formData.get("brandId") ?? "");
  if (!templateId) return { error: "missing templateId" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: tmpl } = await supabase
    .from("post_templates")
    .select("brand_id, prompt")
    .eq("id", templateId)
    .single();
  if (!tmpl) return { error: "找不到模板" };

  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", tmpl.brand_id as string)
    .single();
  if (!brand) return { error: "品牌不存在" };

  try {
    const result = await generateContentVariants(
      tmpl.brand_id as string,
      brand.name as string,
      "threads_post",
      tmpl.prompt as string,
      ""
    );
    const preview = (result.variants[0] ?? "").trim().slice(0, 500);

    // Save as the locked next-post text — cron will use this directly
    await supabase
      .from("post_templates")
      .update({ next_post_text: preview })
      .eq("id", templateId);

    if (brandId) revalidatePath(`/brand/${brandId}/schedule`);
    return { success: true, preview };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "預覽失敗" };
  }
}

// User saves their hand-edited version of next-post text
export async function saveTemplateNextText(
  templateId: string,
  brandId: string,
  text: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!templateId || !brandId) return { ok: false, error: "missing fields" };
  const trimmed = text.trim().slice(0, 500);
  const supabase = await createClient();
  const { error } = await supabase
    .from("post_templates")
    .update({ next_post_text: trimmed || null })
    .eq("id", templateId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/brand/${brandId}/schedule`);
  return { ok: true };
}

// Clear the saved next-post text — so cron will generate fresh next time
export async function clearTemplateNextText(
  templateId: string,
  brandId: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("post_templates")
    .update({ next_post_text: null })
    .eq("id", templateId);
  revalidatePath(`/brand/${brandId}/schedule`);
}

// Edit the AI prompt of an existing template
export async function updateTemplatePrompt(
  templateId: string,
  brandId: string,
  prompt: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!templateId || !brandId) return { ok: false, error: "missing fields" };
  const trimmed = prompt.trim().slice(0, 1500);
  if (!trimmed) return { ok: false, error: "prompt 不能空白" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("post_templates")
    .update({ prompt: trimmed })
    .eq("id", templateId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/brand/${brandId}/schedule`);
  return { ok: true };
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
