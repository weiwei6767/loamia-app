"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteThread } from "./actions";

type Thread = { id: string; title: string; created_at: string };

export function ThreadList({
  brandId,
  threads,
  currentThreadId,
}: {
  brandId: string;
  threads: Thread[];
  currentThreadId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono tracking-widest text-[var(--muted)]">THREADS</div>
        <Link
          href={`/brand/${brandId}`}
          className="text-xs px-2 py-1 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition"
        >
          + 新對話
        </Link>
      </div>

      {threads.length === 0 && (
        <p className="text-xs text-[var(--muted)]">還沒有對話</p>
      )}

      <ul className="space-y-1">
        {threads.map((t) => {
          const isActive = t.id === currentThreadId;
          return (
            <li
              key={t.id}
              className={`group flex items-center justify-between gap-1 text-sm border-l-2 pl-2 pr-1 py-2 ${
                isActive
                  ? "border-[var(--accent)] bg-[var(--surface-2)]"
                  : "border-transparent hover:border-[var(--line)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <Link
                href={`/brand/${brandId}?thread=${t.id}`}
                className="flex-1 truncate"
                title={t.title}
              >
                {t.title}
              </Link>
              <button
                type="button"
                aria-label="刪除對話"
                disabled={pending}
                onClick={() => {
                  if (!confirm("確定刪除這個對話？")) return;
                  startTransition(() => deleteThread(t.id, brandId));
                }}
                className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-red-400 px-1"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
