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
  makeAutoTitle,
  type Tone,
  type Length,
  type Lang,
  type ReportOptions,
} from "@/lib/ai/report";
import { isValidStyle, type StyleKey } from "@/lib/ai/styles";

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
      documents: { id: string; filename: string }[];
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

  let chunks;
  try {
    if (selectedDocIds.length > 0) {
      chunks = await fetchChunksByDocs(brand.id, selectedDocIds);
      if (chunks.length === 0) return { error: "選的文件中沒有可用內容" };
    } else {
      chunks = await retrieveRelevantChunks(brand.id, opts.focus, opts.lang, 50);
      if (!isRelevant(chunks)) {
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
          documents: documents.map((d) => ({ id: d.id, filename: d.filename })),
        };
      }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "查詢失敗" };
  }

  let content: string;
  let citations: unknown;
  try {
    const result = await generateReportFromChunks(brand.name, chunks, opts);
    content = result.content;
    citations = result.citations;
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
