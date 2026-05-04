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
} from "@/lib/ai/report";

export type GenerateState =
  | undefined
  | { error: string }
  | {
      needsSelection: true;
      focus: string;
      documents: { id: string; filename: string }[];
    };

export async function generateReport(
  _state: GenerateState,
  formData: FormData
): Promise<GenerateState> {
  const brandId = String(formData.get("brandId") ?? "");
  const focus = String(formData.get("focus") ?? "").trim();
  const selectedDocIds = formData.getAll("docId").map(String).filter(Boolean);
  if (!brandId) return { error: "missing brandId" };

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
      chunks = await retrieveRelevantChunks(brand.id, focus, 50);
      if (!isRelevant(chunks)) {
        const documents = await listBrandDocuments(brand.id);
        if (documents.length === 0) return { error: "no_documents" };
        return {
          needsSelection: true,
          focus,
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
    const result = await generateReportFromChunks(brand.name, focus, chunks);
    content = result.content;
    citations = result.citations;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "生成失敗" };
  }

  const title = makeAutoTitle(brand.name, focus);

  const { data: report, error: insertErr } = await supabase
    .from("brand_reports")
    .insert({
      brand_id: brand.id,
      agency_id: brand.agency_id,
      user_id: user.id,
      title,
      content,
      citations,
      focus: focus || null,
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
