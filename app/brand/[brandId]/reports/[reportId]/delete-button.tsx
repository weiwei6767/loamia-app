"use client";

import { useTransition } from "react";
import { deleteReport } from "../actions";
import { useI18n } from "@/lib/i18n/provider";

export function DeleteButton({ reportId, brandId }: { reportId: string; brandId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("reports.delete.confirm"))) return;
        startTransition(() => deleteReport(reportId, brandId));
      }}
      className="text-xs text-[var(--muted)] hover:text-red-400 disabled:opacity-50"
    >
      {pending ? <span className="spinner" /> : "✕"}
    </button>
  );
}
