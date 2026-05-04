"use client";

import { useTransition } from "react";
import { deleteDocument } from "./actions";

type Doc = {
  id: string;
  filename: string;
  status: string;
  byte_size: number | null;
  created_at: string;
  error_message: string | null;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function DocumentList({ brandId, documents }: { brandId: string; documents: Doc[] }) {
  const [pending, startTransition] = useTransition();

  if (documents.length === 0) {
    return <p className="text-xs text-[var(--muted)]">還沒有文件</p>;
  }

  return (
    <ul className="space-y-2">
      {documents.map((d) => (
        <li
          key={d.id}
          className="border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs flex items-start justify-between gap-2"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{d.filename}</div>
            <div className="mt-1 text-[var(--muted)]">
              {d.status === "ready" && <span className="text-[var(--accent)]">● 已處理</span>}
              {d.status === "processing" && <span className="text-yellow-400">● 處理中</span>}
              {d.status === "error" && <span className="text-red-400">● 錯誤</span>}
              {d.status === "pending" && <span>● 待處理</span>}
              <span> · {formatSize(d.byte_size)}</span>
            </div>
            {d.error_message && <div className="mt-1 text-red-400 break-words">{d.error_message}</div>}
          </div>
          <button
            onClick={() => startTransition(() => deleteDocument(d.id, brandId))}
            disabled={pending}
            className="shrink-0 text-[var(--muted)] hover:text-red-400 disabled:opacity-50"
            aria-label="刪除"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
