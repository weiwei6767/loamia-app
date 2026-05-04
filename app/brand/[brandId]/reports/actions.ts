"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateReportContent, makeAutoTitle } from "@/lib/ai/report";

export type GenerateState = { error?: string } | undefined;

export async function generateReport(
  _state: GenerateState,
  formData: FormData
): Promise<GenerateState> {
  const brandId = String(formData.get("brandId") ?? "");
  const focus = String(formData.get("focus") ?? "").trim();
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

  let content: string;
  let citations: unknown;
  try {
    const result = await generateReportContent(brand.id, brand.name, focus);
    content = result.content;
    citations = result.citations;
  } catch (err) {
    if (err instanceof Error && err.message === "no_documents") {
      return { error: "no_documents" };
    }
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
