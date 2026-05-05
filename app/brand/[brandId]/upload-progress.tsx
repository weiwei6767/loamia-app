"use client";

import { useEffect, useState } from "react";

type ProgressItem = {
  id: string;
  filename: string;
  status: string;
  progress: number;
  error: string | null;
};

export function UploadProgressList({ brandId }: { brandId: string }) {
  const [items, setItems] = useState<ProgressItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/brand/${brandId}/in-progress-docs`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { items: ProgressItem[] };
          if (!cancelled) setItems(data.items ?? []);
        }
      } catch {
        // ignore network blips
      }
      if (!cancelled) {
        const interval = items.length > 0 ? 1200 : 2500;
        timer = setTimeout(tick, interval);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // intentionally only depends on brandId — items.length read is a soft optimization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono tracking-widest text-[var(--accent)]">
        ⚙ 處理中 · {items.length}
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="border border-[var(--line)] bg-[var(--surface-2)] p-2.5 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate flex-1 min-w-0" title={it.filename}>
                {it.filename}
              </span>
              <span className="font-mono text-[10px] text-[var(--accent)] shrink-0">
                {it.progress}%
              </span>
            </div>
            <div className="w-full h-1 bg-[var(--surface)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-[width] duration-500"
                style={{ width: `${Math.max(2, it.progress)}%` }}
              />
            </div>
            <div className="text-[10px] text-[var(--muted)] font-mono">
              {stageLabel(it.progress)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function stageLabel(pct: number): string {
  if (pct < 10) return "上傳到儲存空間...";
  if (pct < 30) return "解析檔案內容...";
  if (pct < 50) return "切分文字段落...";
  if (pct < 90) return "向量嵌入（embedding）...";
  if (pct < 100) return "寫入資料庫...";
  return "完成";
}
