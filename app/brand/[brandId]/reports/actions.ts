"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  retrieveRelevantChunks,
  fetchChunksByDocs,
  isRelevant,
  listBrandDocuments,
  generateReportFromChunks,
  generateReportFromChunksAsHtml,
  makeAutoTitle,
  type Tone,
  type Length,
  type Lang,
  type ReportOptions,
  type StyleColors,
} from "@/lib/ai/report";
import { isValidStyle, type StyleKey } from "@/lib/ai/styles";
import { analyzeStyleFromImage } from "@/lib/ai/vision";
import { sanitizeReportHtml } from "@/lib/sanitize";
import { listMyThreads } from "@/lib/threads/api";

export type GenerateState =
  | undefined
  | { error: string }
  | {
      needsSelection: true;
      focus: string;
      sections: string;
      tone: Tone;
      length: Length;
      lang: Lang;
      style: StyleKey | "";
      customStyleId: string;
      period: string;
      documents: { id: string; filename: string; tags: string[] | null; period: string | null }[];
    };

const TONES: Tone[] = ["professional", "business", "client", "internal", "casual", "data"];
const LENGTHS: Length[] = ["short", "standard", "detailed"];
const LANGS: Lang[] = ["zh", "en"];

function parseOptions(formData: FormData): ReportOptions {
  const focus = String(formData.get("focus") ?? "").trim();
  const sectionsRaw = String(formData.get("sections") ?? "").trim();
  const sections = sectionsRaw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  const toneRaw = String(formData.get("tone") ?? "professional");
  const tone = (TONES as string[]).includes(toneRaw) ? (toneRaw as Tone) : "professional";

  const lengthRaw = String(formData.get("length") ?? "standard");
  const length = (LENGTHS as string[]).includes(lengthRaw) ? (lengthRaw as Length) : "standard";

  const langRaw = String(formData.get("lang") ?? "zh");
  const lang = (LANGS as string[]).includes(langRaw) ? (langRaw as Lang) : "zh";

  const styleRaw = String(formData.get("style") ?? "");
  const style: StyleKey | undefined = isValidStyle(styleRaw) ? styleRaw : undefined;

  return { focus, sections, tone, length, lang, style };
}

export async function generateReport(
  _state: GenerateState,
  formData: FormData
): Promise<GenerateState> {
  const brandId = String(formData.get("brandId") ?? "");
  const selectedDocIds = formData.getAll("docId").map(String).filter(Boolean);
  const period = String(formData.get("period") ?? "").trim();
  const customStyleId = String(formData.get("customStyleId") ?? "").trim();
  const includeThreads = String(formData.get("includeThreads") ?? "") === "1";
  if (!brandId) return { error: "missing brandId" };

  const opts = parseOptions(formData);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在或無權限" };

  // Apply custom style analysis if specified
  let styleColors: StyleColors | null = null;
  if (customStyleId) {
    const { data: customStyle } = await supabase
      .from("custom_styles")
      .select("analysis, colors")
      .eq("id", customStyleId)
      .single();
    if (customStyle?.analysis) opts.customStyleAnalysis = customStyle.analysis;
    if (customStyle?.colors) styleColors = customStyle.colors as StyleColors;
  }

  let chunks;
  try {
    if (selectedDocIds.length > 0) {
      chunks = await fetchChunksByDocs(brand.id, selectedDocIds);
      if (chunks.length === 0) return { error: "選的文件中沒有可用內容" };
    } else if (period) {
      // Period filter: get all chunks from documents matching this period
      const { data: matchingDocs } = await supabase
        .from("documents")
        .select("id")
        .eq("brand_id", brand.id)
        .eq("period", period);
      if (!matchingDocs || matchingDocs.length === 0) {
        const documents = await listBrandDocuments(brand.id);
        if (documents.length === 0) return { error: "no_documents" };
        return {
          needsSelection: true,
          focus: opts.focus,
          sections: opts.sections.join("\n"),
          tone: opts.tone,
          length: opts.length,
          lang: opts.lang,
          style: opts.style ?? "",
          customStyleId,
          period,
          documents: documents.map((d) => ({
            id: d.id,
            filename: d.filename,
            tags: null,
            period: null,
          })),
        };
      }
      chunks = await fetchChunksByDocs(
        brand.id,
        matchingDocs.map((d) => d.id as string)
      );
    } else {
      chunks = await retrieveRelevantChunks(brand.id, opts.focus, opts.lang, 50);
      if (!isRelevant(chunks) && !includeThreads) {
        const { data: docs } = await supabase
          .from("documents")
          .select("id, filename, tags, period")
          .eq("brand_id", brand.id)
          .eq("status", "ready")
          .order("created_at", { ascending: false });
        if (!docs || docs.length === 0) return { error: "no_documents" };
        return {
          needsSelection: true,
          focus: opts.focus,
          sections: opts.sections.join("\n"),
          tone: opts.tone,
          length: opts.length,
          lang: opts.lang,
          style: opts.style ?? "",
          customStyleId,
          period,
          documents: docs.map((d) => ({
            id: d.id as string,
            filename: d.filename as string,
            tags: (d.tags as string[] | null) ?? null,
            period: (d.period as string | null) ?? null,
          })),
        };
      }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "查詢失敗" };
  }

  if (includeThreads) {
    const { data: conn } = await supabase
      .from("social_connections")
      .select("access_token, platform_user_id, username")
      .eq("brand_id", brand.id)
      .eq("platform", "threads")
      .single();
    if (conn?.access_token && conn?.platform_user_id) {
      try {
        const posts = await listMyThreads(
          conn.platform_user_id as string,
          conn.access_token as string,
          25
        );
        const username = (conn.username as string | null) ?? "unknown";
        const threadsChunks = posts
          .filter((p) => p.text)
          .map((p, i) => ({
            id: `threads-${i}`,
            document_id: "threads-platform",
            filename: `Threads · @${username}`,
            content: `【@${username} 於 ${p.timestamp ?? "未知時間"}】${p.text ?? ""}${p.permalink ? `\n原文：${p.permalink}` : ""}`,
            similarity: 1,
          }));
        chunks = [...(chunks ?? []), ...threadsChunks];
      } catch {
        // platform fetch failed — proceed without threads data
      }
    }
  }

  if (!chunks || chunks.length === 0) {
    return { error: "no_data" };
  }

  let content: string;
  let citations: unknown;
  let format: "markdown" | "html" = "markdown";
  try {
    if (styleColors) {
      // HTML mode — visual fidelity to reference image
      const generatedAt = new Date().toLocaleDateString(opts.lang === "en" ? "en-US" : "zh-TW", {
        year: "numeric",
        month: "long",
      });
      const result = await generateReportFromChunksAsHtml(
        brand.name,
        chunks,
        opts,
        styleColors,
        generatedAt
      );
      content = sanitizeReportHtml(result.content);
      citations = result.citations;
      format = "html";
    } else {
      const result = await generateReportFromChunks(brand.name, chunks, opts);
      content = result.content;
      citations = result.citations;
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "生成失敗" };
  }

  const title = makeAutoTitle(brand.name, opts.focus, opts.lang);

  const { data: report, error: insertErr } = await supabase
    .from("brand_reports")
    .insert({
      brand_id: brand.id,
      agency_id: brand.agency_id,
      user_id: user.id,
      title,
      content,
      citations,
      focus: opts.focus || null,
      style: opts.style ?? null,
      style_colors: styleColors,
      format,
    })
    .select("id")
    .single();
  if (insertErr || !report) {
    return { error: insertErr?.message ?? "儲存失敗" };
  }

  revalidatePath(`/brand/${brandId}/reports`);
  redirect(`/brand/${brandId}/reports/${report.id}`);
}

export async function deleteReport(reportId: string, brandId: string) {
  const supabase = await createClient();
  await supabase.from("brand_reports").delete().eq("id", reportId);
  revalidatePath(`/brand/${brandId}/reports`);
  redirect(`/brand/${brandId}/reports`);
}

// ─── Templates ─────────────────────────────────────

export type SaveTemplateState =
  | undefined
  | { error: string }
  | { success: string };

export async function saveTemplate(
  _state: SaveTemplateState,
  formData: FormData
): Promise<SaveTemplateState> {
  const name = String(formData.get("templateName") ?? "").trim();
  if (!name) return { error: "請輸入模板名稱" };

  const opts = parseOptions(formData);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: memberships } = await supabase
    .from("agency_members")
    .select("agency_id")
    .limit(1);
  const agencyId = memberships?.[0]?.agency_id;
  if (!agencyId) return { error: "no agency" };

  const { error } = await supabase
    .from("report_templates")
    .upsert(
      {
        agency_id: agencyId,
        user_id: user.id,
        name: name.slice(0, 60),
        sections: opts.sections,
        tone: opts.tone,
        length: opts.length,
        lang: opts.lang,
        style: opts.style ?? null,
      },
      { onConflict: "agency_id,name" }
    );
  if (error) return { error: error.message };

  const brandId = String(formData.get("brandId") ?? "");
  if (brandId) revalidatePath(`/brand/${brandId}/reports`);
  return { success: `模板「${name}」已儲存` };
}

export async function deleteTemplate(templateId: string, brandId: string) {
  const supabase = await createClient();
  await supabase.from("report_templates").delete().eq("id", templateId);
  revalidatePath(`/brand/${brandId}/reports`);
}

// ─── Section presets (just the sections list) ─────

export type SectionPresetState =
  | undefined
  | { error: string }
  | { success: string };

export async function saveSectionPreset(
  _state: SectionPresetState,
  formData: FormData
): Promise<SectionPresetState> {
  const name = String(formData.get("presetName") ?? "").trim();
  const sectionsRaw = String(formData.get("sections") ?? "").trim();
  const brandId = String(formData.get("brandId") ?? "");

  if (!name) return { error: "請輸入模板名稱" };
  const sections = sectionsRaw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (sections.length === 0) return { error: "請輸入至少一個段落" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: memberships } = await supabase
    .from("agency_members")
    .select("agency_id")
    .limit(1);
  const agencyId = memberships?.[0]?.agency_id;
  if (!agencyId) return { error: "no agency" };

  const { error } = await supabase.from("section_presets").upsert(
    {
      agency_id: agencyId,
      user_id: user.id,
      name: name.slice(0, 60),
      sections,
    },
    { onConflict: "agency_id,name" }
  );
  if (error) return { error: error.message };

  if (brandId) revalidatePath(`/brand/${brandId}/reports`);
  return { success: `段落「${name}」已儲存` };
}

export async function deleteSectionPreset(presetId: string, brandId: string) {
  const supabase = await createClient();
  await supabase.from("section_presets").delete().eq("id", presetId);
  revalidatePath(`/brand/${brandId}/reports`);
}

// ─── Custom styles (Vision-analyzed reference reports) ─────

export type CustomStyleState =
  | undefined
  | { error: string }
  | { success: string; styleId: string };

export async function analyzeReferenceStyle(
  _state: CustomStyleState,
  formData: FormData
): Promise<CustomStyleState> {
  const file = formData.get("refImage") as File | null;
  const name = String(formData.get("styleName") ?? "").trim();
  const brandId = String(formData.get("brandId") ?? "");

  if (!file || file.size === 0) return { error: "請選擇圖片" };
  if (!name) return { error: "請輸入風格名稱" };
  if (file.size > 8 * 1024 * 1024) return { error: "圖片不能超過 8MB" };
  if (!file.type.startsWith("image/")) return { error: "請上傳圖片檔" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: memberships } = await supabase
    .from("agency_members")
    .select("agency_id")
    .limit(1);
  const agencyId = memberships?.[0]?.agency_id;
  if (!agencyId) return { error: "no agency" };

  const buffer = Buffer.from(await file.arrayBuffer());

  // Optionally upload preview to storage
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".png";
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  const previewPath = `${agencyId}/styles/${Date.now()}-${crypto.randomUUID()}${safeExt}`;
  await supabase.storage
    .from("documents")
    .upload(previewPath, buffer, { contentType: file.type, upsert: false })
    .catch(() => null);

  let analysis: string;
  let colors: unknown = null;
  try {
    const result = await analyzeStyleFromImage(buffer, file.type);
    analysis = result.analysis;
    colors = result.colors;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Vision 分析失敗" };
  }

  const { data: style, error: insertErr } = await supabase
    .from("custom_styles")
    .insert({
      agency_id: agencyId,
      user_id: user.id,
      name: name.slice(0, 60),
      analysis,
      colors,
      preview_path: previewPath,
    })
    .select("id")
    .single();
  if (insertErr || !style) return { error: insertErr?.message ?? "儲存失敗" };

  if (brandId) revalidatePath(`/brand/${brandId}/reports`);
  return { success: name, styleId: style.id };
}

export async function deleteCustomStyle(styleId: string, brandId: string) {
  const supabase = await createClient();
  const { data: style } = await supabase
    .from("custom_styles")
    .select("preview_path")
    .eq("id", styleId)
    .single();
  if (style?.preview_path) {
    await supabase.storage.from("documents").remove([style.preview_path]);
  }
  await supabase.from("custom_styles").delete().eq("id", styleId);
  revalidatePath(`/brand/${brandId}/reports`);
}
