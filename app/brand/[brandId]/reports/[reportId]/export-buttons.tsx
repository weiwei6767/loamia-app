"use client";

import { useI18n } from "@/lib/i18n/provider";

export function ExportButtons({ reportId }: { reportId: string }) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2 no-print">
      <button
        type="button"
        onClick={() => window.print()}
        className="text-xs px-3 py-1.5 border border-[var(--line)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
        title={t("reports.export.print_hint")}
      >
        ↓ {t("reports.export.pdf")}
      </button>
      <a
        href={`/api/reports/${reportId}/docx`}
        download
        className="text-xs px-3 py-1.5 border border-[var(--line)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition inline-flex items-center"
      >
        ↓ {t("reports.export.docx")}
      </a>
    </div>
  );
}
