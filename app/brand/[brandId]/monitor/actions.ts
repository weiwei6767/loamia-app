"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateMonitorReplies } from "@/lib/ai/creative";

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
