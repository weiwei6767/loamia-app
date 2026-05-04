"use client";

import { useTransition } from "react";
import { deleteDocument } from "./actions";
import { useI18n } from "@/lib/i18n/provider";

type Doc = {
  id: string;
  filename: string;
  status: string;
  byte_size: number | null;
  created_at: string;
  error_message: string | null;
  tags?: string[] | null;
  period?: string | null;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function DocumentList({ brandId, documents }: { brandId: string; documents: Doc[] }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  if (documents.length === 0) {
    return <p className="text-xs text-[var(--muted)]">{t("brand.doc.empty")}</p>;
  }

  return (
    <ul className="space-y-2">
      {documents.map((d) => (
        <li
          key={d.id}
          className="border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs flex items-start justify-between gap-2"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{d.filename}</div>
            <div className="mt-1 text-[var(--muted)]">
              {d.status === "ready" && <span className="text-[var(--accent)]">{t("brand.doc.ready")}</span>}
              {d.status === "processing" && <span className="text-yellow-400">{t("brand.doc.processing")}</span>}
              {d.status === "error" && <span className="text-red-400">{t("brand.doc.error")}</span>}
              {d.status === "pending" && <span>{t("brand.doc.pending")}</span>}
              <span> · {formatSize(d.byte_size)}</span>
              {d.period && <span> · {d.period}</span>}
            </div>
            {d.tags && d.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {d.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 border border-[var(--line)] text-[var(--muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {d.error_message && <div className="mt-1 text-red-400 break-words">{d.error_message}</div>}
          </div>
          <button
            onClick={() => startTransition(() => deleteDocument(d.id, brandId))}
            disabled={pending}
            className="shrink-0 text-[var(--muted)] hover:text-red-400 disabled:opacity-50"
            aria-label="✕"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
