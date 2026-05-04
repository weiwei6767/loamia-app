"use client";

import { useActionState } from "react";
import { generateReport, type GenerateState } from "./actions";
import { useI18n } from "@/lib/i18n/provider";

export function GenerateForm({ brandId }: { brandId: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<GenerateState, FormData>(generateReport, undefined);

  const errorText = (() => {
    if (!state?.error) return null;
    if (state.error === "no_documents") return t("reports.error.no_docs");
    return state.error;
  })();

  return (
    <form action={action} className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      <div>
        <label htmlFor="focus" className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]">
          {t("reports.focus.label")}
        </label>
        <input
          id="focus"
          name="focus"
          type="text"
          maxLength={120}
          placeholder={t("reports.focus.placeholder")}
          className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      {errorText && <p className="text-sm text-red-400">{errorText}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full sm:w-auto bg-[var(--accent)] px-6 py-3 text-sm font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {pending ? (
          <>
            <span className="spinner" />
            {t("reports.generating")}
          </>
        ) : (
          <>+ {t("reports.generate")}</>
        )}
      </button>
      {pending && (
        <p className="text-xs text-[var(--muted)]">
          (生成需要 30 秒到 2 分鐘，請耐心等待)
        </p>
      )}
    </form>
  );
}
