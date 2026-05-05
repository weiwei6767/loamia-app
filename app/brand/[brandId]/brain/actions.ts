"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeBrandIdentityFromUrl,
  analyzeCompetitorFromUrl,
} from "@/lib/ai/brand-analyzer";

// ─── Brand Identity (Layer 1) ──────────────────────────

export type IdentityState =
  | undefined
  | { error: string }
  | { success: true };

export async function saveBrandIdentity(
  _state: IdentityState,
  formData: FormData
): Promise<IdentityState> {
  const brandId = String(formData.get("brandId") ?? "");
  if (!brandId) return { error: "missing brandId" };
  const positioning = String(formData.get("positioning") ?? "").trim().slice(0, 1000);
  const target_audience = String(formData.get("target_audience") ?? "").trim().slice(0, 1000);
  const tone_guide = String(formData.get("tone_guide") ?? "").trim().slice(0, 600);
  const tabooRaw = String(formData.get("taboo_words") ?? "").trim();
  const taboo_words = tabooRaw
    ? tabooRaw.split(/[,，、\n]/).map((w) => w.trim()).filter(Boolean).slice(0, 20)
    : [];

  const supabase = await createClient();
  const { error } = await supabase
    .from("brands")
    .update({
      positioning: positioning || null,
      target_audience: target_audience || null,
      tone_guide: tone_guide || null,
      taboo_words: taboo_words.length > 0 ? taboo_words : null,
    })
    .eq("id", brandId);
  if (error) return { error: error.message };

  revalidatePath(`/brand/${brandId}/brain`);
  return { success: true };
}

export type AutoFillState =
  | undefined
  | { error: string }
  | {
      success: true;
      brand_name: string | null;
      positioning: string;
      target_audience: string;
      tone_guide: string;
      taboo_words: string[];
    };

export async function autoFillBrandIdentity(
  _state: AutoFillState,
  formData: FormData
): Promise<AutoFillState> {
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { error: "請輸入網址" };
  if (!/^https?:\/\//.test(url)) return { error: "網址需以 http:// 或 https:// 開頭" };

  try {
    const result = await analyzeBrandIdentityFromUrl(url);
    return { success: true, ...result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "分析失敗" };
  }
}

// ─── Market Intelligence — Competitors (Layer 2) ──────

export type AddCompetitorState =
  | undefined
  | { error: string }
  | { success: true; id: string };

export async function addCompetitor(
  _state: AddCompetitorState,
  formData: FormData
): Promise<AddCompetitorState> {
  const brandId = String(formData.get("brandId") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  if (!brandId || !url) return { error: "missing fields" };
  if (!/^https?:\/\//.test(url)) return { error: "網址需以 http:// 或 https:// 開頭" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, agency_id, positioning")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在" };

  let analysis;
  try {
    analysis = await analyzeCompetitorFromUrl(
      url,
      brand.name as string,
      (brand.positioning as string | null) ?? null
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "分析失敗" };
  }

  const { data: row, error } = await supabase
    .from("brand_intelligence")
    .insert({
      agency_id: brand.agency_id,
      brand_id: brand.id,
      user_id: user.id,
      category: "competitor",
      title: analysis.title.slice(0, 200),
      content: analysis.content,
      source: url,
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "儲存失敗" };

  revalidatePath(`/brand/${brandId}/brain`);
  return { success: true, id: row.id as string };
}

export async function deleteIntelligence(itemId: string, brandId: string) {
  const supabase = await createClient();
  await supabase.from("brand_intelligence").delete().eq("id", itemId);
  revalidatePath(`/brand/${brandId}/brain`);
}

export type AddNoteState =
  | undefined
  | { error: string }
  | { success: true };

export async function addIntelligenceNote(
  _state: AddNoteState,
  formData: FormData
): Promise<AddNoteState> {
  const brandId = String(formData.get("brandId") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const content = String(formData.get("content") ?? "").trim().slice(0, 4000);
  if (!brandId || !title || !content) return { error: "missing fields" };
  const validCats = ["competitor", "market_trend", "industry_term", "audience_insight"];
  if (!validCats.includes(category)) return { error: "invalid category" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在" };

  const { error } = await supabase.from("brand_intelligence").insert({
    agency_id: brand.agency_id,
    brand_id: brand.id,
    user_id: user.id,
    category,
    title,
    content,
    source: null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/brand/${brandId}/brain`);
  return { success: true };
}
