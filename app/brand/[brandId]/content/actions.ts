"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateContentVariants, type ContentType } from "@/lib/ai/creative";

export type ContentState =
  | undefined
  | { error: string }
  | { success: true; outputId: string; type: string };

const VALID_TYPES: ContentType[] = [
  "ig_post",
  "fb_ad",
  "threads_post",
  "kol_brief",
  "campaign_plan",
  "email",
  "custom",
];

export async function generateContent(
  _state: ContentState,
  formData: FormData
): Promise<ContentState> {
  const brandId = String(formData.get("brandId") ?? "");
  const typeRaw = String(formData.get("type") ?? "ig_post");
  const type = (VALID_TYPES as string[]).includes(typeRaw) ? (typeRaw as ContentType) : "ig_post";
  const prompt = String(formData.get("prompt") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim();

  if (!brandId) return { error: "missing brandId" };
  if (!prompt) return { error: "請輸入需求" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在" };

  let variants: string[];
  try {
    const result = await generateContentVariants(brand.id, brand.name, type, prompt, audience);
    variants = result.variants;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "生成失敗" };
  }

  const { data: output, error: insertErr } = await supabase
    .from("content_outputs")
    .insert({
      brand_id: brand.id,
      agency_id: brand.agency_id,
      user_id: user.id,
      type,
      prompt,
      audience: audience || null,
      variants,
    })
    .select("id")
    .single();
  if (insertErr || !output) return { error: insertErr?.message ?? "儲存失敗" };

  revalidatePath(`/brand/${brandId}/content`);
  return { success: true, outputId: output.id as string, type };
}

export async function deleteContentOutput(outputId: string, brandId: string) {
  const supabase = await createClient();
  await supabase.from("content_outputs").delete().eq("id", outputId);
  revalidatePath(`/brand/${brandId}/content`);
}
