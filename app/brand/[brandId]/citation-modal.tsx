"use client";

import { useEffect } from "react";
import type { Citation } from "./chat";
import { useI18n } from "@/lib/i18n/provider";

export function CitationModal({
  citation,
  onClose,
}: {
  citation: Citation | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    if (!citation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [citation, onClose]);

  if (!citation) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-[var(--surface)] border border-[var(--line)]"
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-[var(--line)]">
          <div className="min-w-0">
            <div className="text-xs font-mono tracking-widest text-[var(--accent)] mb-1">{t("citation.label")}</div>
            <div className="font-medium truncate">{citation.filename}</div>
            <div className="text-xs text-[var(--muted)] mt-1">
              {t("citation.similarity.before")}{(citation.similarity * 100).toFixed(1)}%
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("citation.close")}
            className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none px-2"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed whitespace-pre-wrap">
          {citation.content}
        </div>
      </div>
    </div>
  );
}
