import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BrandStatusToggle } from "../brand-status-toggle";
import { GenerateForm } from "./generate-form";
import { ReportsList } from "./reports-list";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, status")
    .eq("id", brandId)
    .single();
  if (!brand) notFound();

  const [
    { data: reports },
    { data: templates },
    { data: sectionPresets },
    { data: customStyles },
    { data: docs },
  ] = await Promise.all([
    supabase
      .from("brand_reports")
      .select("id, title, focus, created_at")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("report_templates")
      .select("id, name, sections, tone, length, lang, style")
      .order("created_at", { ascending: false }),
    supabase
      .from("section_presets")
      .select("id, name, sections")
      .order("created_at", { ascending: false }),
    supabase
      .from("custom_styles")
      .select("id, name, analysis, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, filename, period, created_at")
      .eq("brand_id", brand.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false }),
  ]);

  const t = await getServerT();

  return (
    <div className="mx-auto max-w-5xl w-full px-4 md:px-6 py-8">
        <div className="mb-8">
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
            {t("reports.nav")}
          </div>
          <h2 className="mt-2 text-2xl md:text-3xl font-bold">{t("reports.title")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("reports.subtitle")}</p>
        </div>

        <GenerateForm
          brandId={brand.id}
          templates={templates ?? []}
          sectionPresets={sectionPresets ?? []}
          customStyles={customStyles ?? []}
          documents={(docs ?? []).map((d) => ({
            id: d.id as string,
            filename: d.filename as string,
            period: (d.period as string | null) ?? null,
          }))}
        />

        <div className="mt-12">
          <h3 className="font-mono text-xs tracking-widest text-[var(--muted)] mb-4">
            HISTORY · {reports?.length ?? 0}
          </h3>
          <ReportsList brandId={brand.id} reports={reports ?? []} />
        </div>
    </div>
  );
}
