"use client";

import { useState, useTransition } from "react";
import { quickSchedulePost } from "./schedule/actions";

export function SchedulePopoverButton({
  brandId,
  text,
  buttonClassName,
  buttonLabel = "📅 排程發送",
}: {
  brandId: string;
  text: string;
  buttonClassName?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [scheduledAt, setScheduledAt] = useState(() =>
    new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function submit() {
    setMsg(null);
    startTransition(async () => {
      const result = await quickSchedulePost(brandId, text, scheduledAt);
      if (result.ok) {
        setMsg({ kind: "ok", text: "✓ 已加入排程，前往 SCHEDULE 查看" });
        setTimeout(() => {
          setOpen(false);
          setMsg(null);
        }, 1800);
      } else {
        setMsg({ kind: "err", text: result.error });
      }
    });
  }

  const minDateTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={!text.trim()}
        onClick={() => setOpen((v) => !v)}
        className={
          buttonClassName ??
          "text-xs px-3 py-1.5 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition disabled:opacity-50"
        }
      >
        {buttonLabel}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[150]"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 top-full mt-2 z-[151] w-80 max-w-[calc(100vw-2rem)] border border-[var(--accent)] bg-[var(--surface)] p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
              📅 排程發送到 Threads
            </div>
            <div className="text-xs text-[var(--muted)] line-clamp-3 border-l-2 border-[var(--line)] pl-2 leading-relaxed">
              {text.trim().slice(0, 200)}
              {text.length > 200 ? "..." : ""}
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-mono text-[var(--muted)]">
                發送時間
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={minDateTime}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1.5 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            {msg && (
              <p
                className={`text-xs ${
                  msg.kind === "ok" ? "text-[var(--accent)]" : "text-red-400"
                }`}
              >
                {msg.text}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="flex-1 bg-[var(--accent)] py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {pending ? (
                  <>
                    <span className="spinner" /> 排程中
                  </>
                ) : (
                  "✓ 確認排程"
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-xs border border-[var(--line)] text-[var(--muted)] hover:text-[var(--foreground)] transition"
              >
                取消
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
