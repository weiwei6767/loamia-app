"use client";

import { useActionState, useRef, useEffect } from "react";
import { uploadDocument, type UploadState } from "./actions";
import { useI18n } from "@/lib/i18n/provider";
import { UploadProgressList } from "./upload-progress";

export function Uploader({ brandId }: { brandId: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadDocument, undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.success && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [state]);

  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="brandId" value={brandId} />
      <input
        ref={inputRef}
        name="file"
        type="file"
        accept=".txt,.md,.pdf,.docx,.xlsx,.xls,.csv,.pptx,.ppt"
        multiple
        required
        className="block w-full text-xs text-[var(--muted)] file:mr-3 file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-2 file:text-xs file:text-[var(--foreground)] hover:file:bg-[var(--accent)] hover:file:text-[var(--background)]"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--accent)] py-2 text-xs font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50"
      >
        {pending ? t("brand.upload.processing") : t("brand.upload.button")}
      </button>
      {state?.error && <p className="text-xs text-red-400 whitespace-pre-wrap">{state.error}</p>}
      {state?.success && <p className="text-xs text-[var(--accent)]">{state.success}</p>}
      <p className="text-xs text-[var(--muted)]">{t("brand.upload.help")}</p>
      <UploadProgressList brandId={brandId} />
    </form>
  );
}
