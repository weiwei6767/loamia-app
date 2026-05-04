import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { DeleteButton } from "./delete-button";
import { ExportButtons } from "./export-buttons";
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
    .select("id, title, content, citations, focus, created_at, style, style_colors")
    .eq("id", reportId)
    .single();
  if (!report) notFound();

  const t = await getServerT();
  const citations = (report.citations as Citation[] | null) ?? [];
  const uniqueFiles = Array.from(new Set(citations.map((c) => c.filename))).filter(Boolean);

  type StyleColors = {
    bg: string;
    fg: string;
    accent: string;
    surface: string;
    headingFont: "serif" | "sans-serif" | "monospace";
    bodyFont: "serif" | "sans-serif" | "monospace";
    layout: string;
  };

  const customColors = report.style_colors as StyleColors | null;
  const styleDef = isValidStyle(report.style) ? STYLES[report.style] : null;

  function fontStack(kind: "serif" | "sans-serif" | "monospace"): string {
    if (kind === "serif") return "Georgia, 'Playfair Display', 'Microsoft JhengHei', serif";
    if (kind === "monospace") return "'JetBrains Mono', Consolas, monospace";
    return "system-ui, -apple-system, 'Microsoft JhengHei', sans-serif";
  }

  const containerStyle = customColors
    ? { backgroundColor: customColors.bg, color: customColors.fg }
    : styleDef
      ? { backgroundColor: styleDef.css.bg, color: styleDef.css.fg }
      : undefined;
  const headingStyle = customColors
    ? { fontFamily: fontStack(customColors.headingFont) }
    : styleDef
      ? { fontFamily: styleDef.css.fontHeading }
      : undefined;
  const bodyStyle = customColors
    ? { fontFamily: fontStack(customColors.bodyFont), color: customColors.fg }
    : styleDef
      ? { fontFamily: styleDef.css.fontBody, color: styleDef.css.fg }
      : undefined;
  const accentStyle = customColors
    ? { color: customColors.accent }
    : styleDef
      ? { color: styleDef.css.accent }
      : undefined;
  const accentColor = customColors?.accent ?? styleDef?.css.accent ?? "var(--accent)";
  const styleLabel = customColors
    ? `Custom · ${customColors.layout}`
    : styleDef
      ? `${styleDef.zh} · ${styleDef.en}`
      : null;

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--line)] no-print">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 md:px-6 py-4 gap-4 flex-wrap">
          <Link
            href={`/brand/${brand.id}/reports`}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {t("reports.back")}
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <ExportButtons reportId={report.id} />
            {styleLabel && (
              <span
                className="text-xs px-2 py-1 border"
                style={{ borderColor: accentColor, color: accentColor }}
              >
                {styleLabel}
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
            style={{ borderColor: accentColor }}
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

          <div className="markdown-body text-[15px] leading-[1.85]" style={bodyStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content}</ReactMarkdown>
          </div>

          {uniqueFiles.length > 0 && (
            <div
              className="mt-12 pt-6 border-t"
              style={{ borderColor: accentColor }}
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
