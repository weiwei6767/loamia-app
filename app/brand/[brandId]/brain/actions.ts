"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeBrandIdentityFromUrl,
  analyzeCompetitorFromUrl,
} from "@/lib/ai/brand-analyzer";
import { chunkText, buildChunkRows } from "@/lib/ai/ingest";

async function saveFetchedContentAsDocument(
  supabase: SupabaseClient,
  brand: { id: string; agency_id: string },
  userId: string,
  params: {
    url: string;
    pageTitle: string;
    text: string;
    tags: string[];
    filename?: string;
  }
): Promise<{ ok: true; documentId: string } | { ok: false; error: string }> {
  const filename =
    params.filename ||
    `${params.pageTitle || new URL(params.url).hostname}（${new Date()
      .toISOString()
      .slice(0, 10)}）.txt`;

  // Upload text to storage
  const buffer = Buffer.from(params.text, "utf-8");
  const storagePath = `${brand.agency_id}/${brand.id}/${Date.now()}-${crypto.randomUUID()}.txt`;
  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: "text/plain", upsert: false });
  if (uploadErr) return { ok: false, error: `儲存失敗：${uploadErr.message}` };

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      brand_id: brand.id,
      agency_id: brand.agency_id,
      filename,
      storage_path: storagePath,
      mime_type: "text/plain",
      byte_size: buffer.length,
      status: "processing",
      progress_pct: 30,
      tags: params.tags,
    })
    .select("id")
    .single();
  if (docErr || !doc) {
    await supabase.storage.from("documents").remove([storagePath]);
    return { ok: false, error: docErr?.message ?? "建立文件失敗" };
  }

  const setProgress = async (pct: number) => {
    await supabase.from("documents").update({ progress_pct: pct }).eq("id", doc.id);
  };

  try {
    const chunks = chunkText(params.text);
    await setProgress(50);
    const rows = await buildChunkRows(chunks, doc.id, brand.id, brand.agency_id);
    await setProgress(90);
    if (rows.length > 0) {
      const { error: chunkErr } = await supabase.from("document_chunks").insert(rows);
      if (chunkErr) throw new Error(chunkErr.message);
    }
    await supabase
      .from("documents")
      .update({ status: "ready", progress_pct: 100 })
      .eq("id", doc.id);
    return { ok: true, documentId: doc.id as string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "embedding 失敗";
    await supabase
      .from("documents")
      .update({ status: "error", error_message: msg, progress_pct: 0 })
      .eq("id", doc.id);
    return { ok: false, error: msg };
  }
}

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
      savedToDataId?: string;
    };

export async function autoFillBrandIdentity(
  _state: AutoFillState,
  formData: FormData
): Promise<AutoFillState> {
  const brandId = String(formData.get("brandId") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const saveToData = String(formData.get("saveToData") ?? "") === "1";
  if (!url) return { error: "請輸入網址" };
  if (!/^https?:\/\//.test(url)) return { error: "網址需以 http:// 或 https:// 開頭" };

  let result;
  try {
    result = await analyzeBrandIdentityFromUrl(url);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "分析失敗" };
  }

  let savedToDataId: string | undefined;
  if (saveToData && brandId && result.fetchedText) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: brand } = await supabase
      .from("brands")
      .select("id, agency_id, name")
      .eq("id", brandId)
      .single();
    if (user && brand) {
      const save = await saveFetchedContentAsDocument(
        supabase,
        { id: brand.id as string, agency_id: brand.agency_id as string },
        user.id,
        {
          url,
          pageTitle: result.pageTitle,
          text: result.fetchedText,
          tags: ["brand_identity", "auto-fetched", brand.name as string],
        }
      );
      if (save.ok) savedToDataId = save.documentId;
      revalidatePath(`/brand/${brandId}/data`);
    }
  }

  return {
    success: true,
    brand_name: result.brand_name,
    positioning: result.positioning,
    target_audience: result.target_audience,
    tone_guide: result.tone_guide,
    taboo_words: result.taboo_words,
    savedToDataId,
  };
}

// ─── Market Intelligence — Competitors (Layer 2) ──────

export type AddCompetitorState =
  | undefined
  | { error: string }
  | {
      irrelevant: true;
      url: string;
      relevance_score: number;
      relevance_reason: string;
      title: string;
      saveToData: boolean;
    }
  | { success: true; id: string; savedToDataId?: string };

export async function addCompetitor(
  _state: AddCompetitorState,
  formData: FormData
): Promise<AddCompetitorState> {
  const brandId = String(formData.get("brandId") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const force = String(formData.get("force") ?? "") === "1";
  const saveToData = String(formData.get("saveToData") ?? "") === "1";
  if (!brandId || !url) return { error: "missing fields" };
  if (!/^https?:\/\//.test(url)) return { error: "網址需以 http:// 或 https:// 開頭" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, agency_id, positioning, target_audience")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在" };

  let analysis;
  try {
    analysis = await analyzeCompetitorFromUrl(
      url,
      brand.name as string,
      (brand.positioning as string | null) ?? null,
      (brand.target_audience as string | null) ?? null
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "分析失敗" };
  }

  // Relevance gate: if AI judges not relevant and user hasn't forced, return rejection
  if (!analysis.is_competitor && !force) {
    return {
      irrelevant: true,
      url,
      relevance_score: analysis.relevance_score,
      relevance_reason: analysis.relevance_reason,
      title: analysis.title,
      saveToData,
    };
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

  let savedToDataId: string | undefined;
  if (saveToData && analysis.fetchedText) {
    const result = await saveFetchedContentAsDocument(
      supabase,
      { id: brand.id as string, agency_id: brand.agency_id as string },
      user.id,
      {
        url,
        pageTitle: analysis.pageTitle,
        text: analysis.fetchedText,
        tags: ["competitor", "auto-fetched", brand.name as string],
      }
    );
    if (result.ok) savedToDataId = result.documentId;
  }

  revalidatePath(`/brand/${brandId}/brain`);
  if (saveToData) revalidatePath(`/brand/${brandId}/data`);
  return { success: true, id: row.id as string, savedToDataId };
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
