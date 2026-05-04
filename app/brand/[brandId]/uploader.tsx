"use client";

import { useActionState, useRef, useEffect } from "react";
import { uploadDocument, type UploadState } from "./actions";

export function Uploader({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadDocument, undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.success && inputRef.current) inputRef.current.value = "";
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="brandId" value={brandId} />
      <input
        ref={inputRef}
        name="file"
        type="file"
        accept=".txt,.md,.pdf,.docx"
        required
        className="block w-full text-xs text-[var(--muted)] file:mr-3 file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-2 file:text-xs file:text-[var(--foreground)] hover:file:bg-[var(--accent)] hover:file:text-[var(--background)]"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--accent)] py-2 text-xs font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50"
      >
        {pending ? "處理中..." : "上傳並處理"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
      {state?.success && <p className="text-xs text-[var(--accent)]">{state.success}</p>}
      <p className="text-xs text-[var(--muted)]">支援 .txt / .md / .pdf / .docx，10MB 內</p>
    </form>
  );
}
