"use client";

import { useActionState, useState } from "react";
import { generateReport, type GenerateState } from "./actions";
import { useI18n } from "@/lib/i18n/provider";
import { Uploader } from "../uploader";

export function GenerateForm({ brandId }: { brandId: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<GenerateState, FormData>(generateReport, undefined);

  const isPicker = state && "needsSelection" in state && state.needsSelection;
  const errorText = (() => {
    if (!state || !("error" in state) || !state.error) return null;
    if (state.error === "no_documents") return t("reports.error.no_docs");
    return state.error;
  })();

  if (isPicker) {
    return <Picker brandId={brandId} state={state} action={action} pending={pending} />;
  }

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

function Picker({
  brandId,
  state,
  action,
  pending,
}: {
  brandId: string;
  state: Extract<GenerateState, { needsSelection: true }>;
  action: (payload: FormData) => void;
  pending: boolean;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="border border-[var(--accent)]/40 bg-[var(--surface)] p-5 space-y-5">
      <div>
        <div className="font-mono text-xs tracking-widest text-[var(--accent)] mb-2">
          ⚠ {t("reports.select.heading")}
        </div>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          {t("reports.select.body.before")}
          <span className="text-[var(--foreground)] font-medium">{state.focus || "—"}</span>
          {t("reports.select.body.after")}
        </p>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="focus" value={state.focus} />

        <div>
          <div className="text-xs font-medium tracking-wide text-[var(--muted)] mb-2">
            {t("reports.select.docs")}
          </div>
          <ul className="space-y-1 max-h-64 overflow-y-auto border border-[var(--line)] bg-[var(--surface-2)] p-2">
            {state.documents.map((d) => (
              <li key={d.id}>
                <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--surface)] text-sm">
                  <input
                    type="checkbox"
                    name="docId"
                    value={d.id}
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="truncate">{d.filename}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || selected.size === 0}
            className="bg-[var(--accent)] px-5 py-2.5 text-sm font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50 inline-flex items-center gap-2"
          >
            {pending ? (
              <>
                <span className="spinner" />
                {t("reports.generating")}
              </>
            ) : (
              <>+ {t("reports.select.generate")}</>
            )}
          </button>
          {selected.size === 0 && (
            <span className="text-xs text-[var(--muted)]">{t("reports.select.empty_pick")}</span>
          )}
        </div>
      </form>

      <div className="pt-4 border-t border-[var(--line)]">
        <button
          type="button"
          onClick={() => setShowUpload((v) => !v)}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          {showUpload ? "× 收起上傳" : `+ ${t("reports.select.upload")}`}
        </button>
        {showUpload && (
          <div className="mt-3 p-3 bg-[var(--surface-2)] border border-[var(--line)]">
            <Uploader brandId={brandId} />
            <p className="mt-2 text-xs text-[var(--muted)]">
              {t("reports.select.upload_hint")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
