"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { uploadDocument, type UploadState } from "./actions";
import { useI18n } from "@/lib/i18n/provider";

export function Uploader({ brandId }: { brandId: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadDocument, undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tags, setTags] = useState("");
  const [period, setPeriod] = useState("");

  useEffect(() => {
    if (state?.success && inputRef.current) {
      inputRef.current.value = "";
      setTags("");
      setPeriod("");
    }
  }, [state]);

  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="brandId" value={brandId} />
      <input
        ref={inputRef}
        name="file"
        type="file"
        accept=".txt,.md,.pdf,.docx"
        required
        className="block w-full text-xs text-[var(--muted)] file:mr-3 file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-2 file:text-xs file:text-[var(--foreground)] hover:file:bg-[var(--accent)] hover:file:text-[var(--background)]"
      />

      <input
        name="tags"
        type="text"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        maxLength={120}
        placeholder={t("brand.upload.tags.placeholder")}
        className="w-full text-xs px-2 py-1.5 border border-[var(--line)] bg-[var(--surface-2)] focus:border-[var(--accent)] focus:outline-none"
      />

      <input
        name="period"
        type="text"
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        maxLength={20}
        placeholder={t("brand.upload.period.placeholder")}
        className="w-full text-xs px-2 py-1.5 border border-[var(--line)] bg-[var(--surface-2)] focus:border-[var(--accent)] focus:outline-none"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--accent)] py-2 text-xs font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50"
      >
        {pending ? t("brand.upload.processing") : t("brand.upload.button")}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
      {state?.success && <p className="text-xs text-[var(--accent)]">{state.success}</p>}
      <p className="text-xs text-[var(--muted)]">{t("brand.upload.help")}</p>
    </form>
  );
}
