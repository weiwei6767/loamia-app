"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeReferenceStyle,
  deleteCustomStyle,
  type CustomStyleState,
} from "../reports/actions";
import { useI18n } from "@/lib/i18n/provider";

type CustomStyle = {
  id: string;
  name: string;
  analysis: string;
  created_at: string;
};

export function VisionUploadSection({ brandId }: { brandId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState<CustomStyleState, FormData>(
    analyzeReferenceStyle,
    undefined
  );
  const [name, setName] = useState("");

  useEffect(() => {
    if (state && "success" in state && state.success) {
      router.refresh();
      setName("");
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="brandId" value={brandId} />
      <input
        name="refImage"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        required
        className="block w-full text-xs text-[var(--muted)] file:mr-3 file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-2 file:text-xs file:text-[var(--foreground)] hover:file:bg-[var(--accent)] hover:file:text-[var(--background)]"
      />
      <div className="flex gap-2">
        <input
          name="styleName"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder={t("reports.vision.name.placeholder")}
          className="flex-1 text-xs px-2 py-1.5 border border-[var(--line)] bg-[var(--surface-2)] focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="text-xs px-3 py-1.5 bg-[var(--accent)] text-[var(--background)] font-bold hover:bg-[var(--accent-glow)] disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {pending ? (
            <>
              <span className="spinner" />
              {t("reports.vision.analyzing")}
            </>
          ) : (
            t("reports.vision.upload")
          )}
        </button>
      </div>
      {state && "error" in state && state.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      {state && "success" in state && state.success && (
        <p className="text-xs text-[var(--accent)]">
          ✓ {t("reports.vision.success")}：{state.success}
        </p>
      )}
    </form>
  );
}

export function CustomStylesList({
  styles,
  brandId,
}: {
  styles: CustomStyle[];
  brandId: string;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <ul className="space-y-2">
      {styles.map((s) => (
        <li
          key={s.id}
          className="border border-[var(--line)] bg-[var(--surface-2)] p-3 flex items-start justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{s.name}</div>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              {new Date(s.created_at).toLocaleString()}
            </div>
            <div className="text-xs text-[var(--muted)] mt-1.5 line-clamp-2">
              {s.analysis.slice(0, 200)}
            </div>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(t("reports.vision.delete.confirm"))) return;
              startTransition(() => deleteCustomStyle(s.id, brandId));
            }}
            className="shrink-0 text-[var(--muted)] hover:text-red-400 disabled:opacity-50 text-xs"
            aria-label="delete"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
