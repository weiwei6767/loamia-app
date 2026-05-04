import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { DeleteButton } from "./delete-button";
import { STYLES, isValidStyle } from "@/lib/ai/styles";

type Citation = {
  id: string;
  document_id: string;
  filename: string;
  chunk_index: number;
};

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ brandId: string; reportId: string }>;
}) {
  const { brandId, reportId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .single();
  if (!brand) notFound();

  const { data: report } = await supabase
    .from("brand_reports")
    .select("id, title, content, citations, focus, created_at, style")
    .eq("id", reportId)
    .single();
  if (!report) notFound();

  const t = await getServerT();
  const citations = (report.citations as Citation[] | null) ?? [];
  const uniqueFiles = Array.from(new Set(citations.map((c) => c.filename))).filter(Boolean);

  const styleDef = isValidStyle(report.style) ? STYLES[report.style] : null;
  const containerStyle = styleDef
    ? {
        backgroundColor: styleDef.css.bg,
        color: styleDef.css.fg,
      }
    : undefined;
  const headingStyle = styleDef ? { fontFamily: styleDef.css.fontHeading } : undefined;
  const bodyStyle = styleDef
    ? { fontFamily: styleDef.css.fontBody, color: styleDef.css.fg }
    : undefined;
  const accentStyle = styleDef ? { color: styleDef.css.accent } : undefined;

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 md:px-6 py-4 gap-4">
          <Link
            href={`/brand/${brand.id}/reports`}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {t("reports.back")}
          </Link>
          <div className="flex items-center gap-3">
            {styleDef && (
              <span
                className="text-xs px-2 py-1 border"
                style={{ borderColor: styleDef.css.accent, color: styleDef.css.accent }}
              >
                {styleDef.zh} · {styleDef.en}
              </span>
            )}
            <DeleteButton reportId={report.id} brandId={brand.id} />
          </div>
        </div>
      </header>

      <div style={containerStyle} className="flex-1">
        <article className="mx-auto max-w-3xl w-full px-4 md:px-6 py-10">
          <div
            className="mb-8 pb-6 border-b"
            style={{ borderColor: styleDef?.css.accent ?? "var(--line)" }}
          >
            <div
              className="text-xs font-mono tracking-widest mb-2"
              style={accentStyle ?? { color: "var(--accent)" }}
            >
              {brand.name.toUpperCase()} · {t("reports.nav")}
            </div>
            <h1
              className="text-2xl md:text-3xl font-bold leading-tight"
              style={headingStyle}
            >
              {report.title}
            </h1>
            <div className="mt-3 text-xs opacity-70">
              {t("reports.created")} {new Date(report.created_at).toLocaleString()}
              {report.focus && <span> · {report.focus}</span>}
            </div>
          </div>

          <div
            className="prose-content text-[15px] leading-[1.85] whitespace-pre-wrap"
            style={bodyStyle}
          >
            {report.content}
          </div>

          {uniqueFiles.length > 0 && (
            <div
              className="mt-12 pt-6 border-t"
              style={{ borderColor: styleDef?.css.accent ?? "var(--line)" }}
            >
              <div
                className="text-xs font-mono tracking-widest mb-3 opacity-70"
                style={accentStyle}
              >
                {t("reports.citation.label")}
              </div>
              <ul className="text-sm opacity-70 space-y-1">
                {uniqueFiles.map((f, i) => (
                  <li key={i}>· {f}</li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}
