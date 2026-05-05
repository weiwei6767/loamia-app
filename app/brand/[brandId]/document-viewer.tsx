"use client";

import { useEffect, useState } from "react";
import { getDocumentPreview, type DocumentPreview } from "./actions";

export function DocumentViewer({
  docId,
  onClose,
}: {
  docId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<DocumentPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!docId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setData(null);
    getDocumentPreview(docId).then((res) => {
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    if (!docId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [docId, onClose]);

  if (!docId) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background)] border border-[var(--line)] w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
              DOCUMENT VIEWER
            </div>
            <div className="text-sm font-bold truncate">
              {loading ? "載入中..." : data && "ok" in data && data.ok ? data.filename : "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl shrink-0"
            aria-label="close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="p-8 text-center text-sm text-[var(--muted)]">
              <span className="spinner mr-2" />
              載入文件中...
            </div>
          )}

          {data && !data.ok && (
            <div className="p-8 text-center text-sm text-red-400">{data.error}</div>
          )}

          {data && data.ok && (
            <ViewerBody data={data} />
          )}
        </div>

        {data && data.ok && (
          <footer className="px-5 py-3 border-t border-[var(--line)] flex items-center justify-between gap-2 text-xs">
            <span className="text-[var(--muted)] font-mono truncate">
              {data.mimeType ?? "unknown"}
            </span>
            <a
              href={data.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition"
            >
              ↗ 在新分頁開啟 / 下載
            </a>
          </footer>
        )}
      </div>
    </div>
  );
}

function ViewerBody({ data }: { data: Extract<DocumentPreview, { ok: true }> }) {
  const mime = data.mimeType ?? "";

  // Text-like → inline display
  if (data.textContent !== null) {
    return (
      <div className="p-5 space-y-2">
        {data.truncated && (
          <p className="text-[10px] text-yellow-400 font-mono">
            ⚠ 內容過長，僅顯示前 50,000 字。完整內容請按「在新分頁開啟」下載。
          </p>
        )}
        <pre className="whitespace-pre-wrap text-xs leading-relaxed font-mono bg-[var(--surface-2)] p-4 border border-[var(--line)]">
          {data.textContent}
        </pre>
      </div>
    );
  }

  // PDF → embed
  if (mime === "application/pdf") {
    return (
      <iframe
        src={data.signedUrl}
        className="w-full h-[70vh] border-0"
        title={data.filename}
      />
    );
  }

  // Image → show
  if (mime.startsWith("image/")) {
    return (
      <div className="p-5 flex items-center justify-center">
        <img
          src={data.signedUrl}
          alt={data.filename}
          className="max-w-full max-h-[70vh] object-contain border border-[var(--line)]"
        />
      </div>
    );
  }

  // Office docs / unknown → download prompt
  return (
    <div className="p-8 text-center space-y-3">
      <div className="text-4xl">📄</div>
      <p className="text-sm text-[var(--muted)]">
        此檔案類型（{mime || "unknown"}）瀏覽器無法直接顯示
      </p>
      <a
        href={data.signedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-4 py-2 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition text-sm"
      >
        ↗ 下載查看
      </a>
    </div>
  );
}
