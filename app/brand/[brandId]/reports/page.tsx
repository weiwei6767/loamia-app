import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { GenerateForm } from "./generate-form";

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
    .select("id, name")
    .eq("id", brandId)
    .single();
  if (!brand) notFound();

  const [{ data: reports }, { data: templates }, { data: sectionPresets }, { data: customStyles }] =
    await Promise.all([
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
    ]);

  const t = await getServerT();

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 md:px-6 py-4 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href={`/brand/${brand.id}`}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
            >
              {t("brand.back")}
            </Link>
            <div className="min-w-0">
              <div className="text-xs font-mono tracking-widest text-[var(--accent)]">
                {t("brand.label")}
              </div>
              <h1 className="text-lg font-bold truncate">{brand.name}</h1>
            </div>
          </div>
          <nav className="flex items-center gap-1 text-xs font-mono">
            <Link
              href={`/brand/${brand.id}`}
              className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {t("reports.chat")}
            </Link>
            <Link
              href={`/brand/${brand.id}/data`}
              className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {t("data.nav")}
            </Link>
            <Link
              href={`/brand/${brand.id}/reports`}
              className="px-3 py-1.5 border-b-2 border-[var(--accent)] text-[var(--accent)]"
            >
              {t("reports.nav")}
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl w-full px-4 md:px-6 py-10">
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
        />

        <div className="mt-10">
          {(!reports || reports.length === 0) ? (
            <p className="text-sm text-[var(--muted)]">{t("reports.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/brand/${brand.id}/reports/${r.id}`}
                    className="block border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]/50"
                  >
                    <div className="font-medium">{r.title}</div>
                    <div className="mt-1 text-xs text-[var(--muted)] flex items-center gap-3">
                      <span>{new Date(r.created_at).toLocaleString()}</span>
                      {r.focus && <span>· {r.focus}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
