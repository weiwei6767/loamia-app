"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument } from "./actions";
import { useI18n } from "@/lib/i18n/provider";

export function InlineUploader({ brandId }: { brandId: string }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const router = useRouter();

  function handleFileChange() {
    const files = inputRef.current?.files;
    setFileNames(files ? Array.from(files).map((f) => f.name) : []);
    setMsg(null);
  }

  function handleUpload() {
    const files = inputRef.current?.files;
    if (!files || files.length === 0) {
      setMsg({ kind: "err", text: "請選擇檔案" });
      return;
    }
    const fd = new FormData();
    fd.append("brandId", brandId);
    for (const f of Array.from(files)) fd.append("file", f);
    startTransition(async () => {
      setMsg(null);
      const result = await uploadDocument(undefined, fd);
      if (result && "success" in result && result.success) {
        setMsg({ kind: "ok", text: result.success });
        if (inputRef.current) inputRef.current.value = "";
        setFileNames([]);
        router.refresh();
      } else if (result && "error" in result && result.error) {
        setMsg({ kind: "err", text: result.error });
      }
    });
  }

  return (
    <div className="space-y-2.5">
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md,.pdf,.docx,.xlsx,.xls,.csv,.pptx,.ppt"
        multiple
        onChange={handleFileChange}
        className="block w-full text-xs text-[var(--muted)] file:mr-3 file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-2 file:text-xs file:text-[var(--foreground)] hover:file:bg-[var(--accent)] hover:file:text-[var(--background)]"
      />
      {fileNames.length > 0 && (
        <div className="text-[10px] text-[var(--muted)] font-mono">
          {fileNames.length} {t("brand.upload.selected")}：{fileNames.slice(0, 3).join(", ")}
          {fileNames.length > 3 ? ` ...+${fileNames.length - 3}` : ""}
        </div>
      )}
      <button
        type="button"
        onClick={handleUpload}
        disabled={pending}
        className="w-full bg-[var(--accent)] py-2 text-xs font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {pending ? (
          <>
            <span className="spinner" />
            {t("brand.upload.processing")}
          </>
        ) : (
          t("brand.upload.button")
        )}
      </button>
      {msg && (
        <p className={`text-xs whitespace-pre-wrap ${msg.kind === "ok" ? "text-[var(--accent)]" : "text-red-400"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
