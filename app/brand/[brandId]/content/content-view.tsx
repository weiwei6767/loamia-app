"use client";

import { useActionState, useState, useTransition } from "react";
import { generateContent, deleteContentOutput, type ContentState } from "./actions";
import { useI18n } from "@/lib/i18n/provider";

type ContentRow = {
  id: string;
  type: string;
  prompt: string;
  audience: string | null;
  variants: string[];
  created_at: string;
};

const TYPE_OPTIONS = [
  { key: "ig_post", icon: "📷" },
  { key: "fb_ad", icon: "📢" },
  { key: "threads_post", icon: "🧵" },
  { key: "kol_brief", icon: "🤝" },
  { key: "campaign_plan", icon: "📋" },
  { key: "email", icon: "✉" },
  { key: "custom", icon: "✏" },
] as const;

export function ContentView({
  brandId,
  history,
}: {
  brandId: string;
  history: ContentRow[];
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<ContentState, FormData>(
    generateContent,
    undefined
  );
  const [type, setType] = useState<string>("ig_post");

  return (
    <>
      <form
        action={action}
        className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-5"
      >
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="type" value={type} />

        {/* Type picker */}
        <div>
          <label className="mb-2 block text-xs font-medium tracking-wide text-[var(--muted)]">
            {t("content.type.label")}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {TYPE_OPTIONS.map((opt) => {
              const active = type === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setType(opt.key)}
                  className={`aspect-[4/3] flex flex-col items-center justify-center gap-1 border text-xs transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)] font-bold"
                      : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  <span className="text-2xl leading-none">{opt.icon}</span>
                  <span className="text-[11px]">{t(`content.type.${opt.key}` as never)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt */}
        <div>
          <label
            htmlFor="prompt"
            className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]"
          >
            {t("content.prompt.label")}
          </label>
          <textarea
            id="prompt"
            name="prompt"
            rows={3}
            required
            maxLength={500}
            placeholder={t("content.prompt.placeholder")}
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none leading-relaxed"
          />
        </div>

        {/* Audience */}
        <div>
          <label
            htmlFor="audience"
            className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]"
          >
            {t("content.audience.label")}
          </label>
          <input
            id="audience"
            name="audience"
            type="text"
            maxLength={120}
            placeholder={t("content.audience.placeholder")}
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full sm:w-auto bg-[var(--accent)] px-6 py-3 text-sm font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {pending ? (
            <>
              <span className="spinner" />
              {t("content.generating")}
            </>
          ) : (
            <>+ {t("content.generate")}</>
          )}
        </button>
        {pending && (
          <p className="text-xs text-[var(--muted)]">
            (生成 3 個變體約 30-60 秒)
          </p>
        )}
      </form>

      {/* History */}
      <div className="space-y-4">
        <div className="font-mono text-xs tracking-widest text-[var(--muted)]">
          {t("content.history")} · {history.length}
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("content.history.empty")}</p>
        ) : (
          <ul className="space-y-4">
            {history.map((row) => (
              <HistoryCard key={row.id} row={row} brandId={brandId} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function HistoryCard({ row, brandId }: { row: ContentRow; brandId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(0);

  const variant = row.variants[active] ?? "";

  return (
    <li className="border border-[var(--line)] bg-[var(--surface)]">
      <header className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono tracking-widest text-[var(--accent)]">
            {t(`content.type.${row.type}` as never)}
          </span>
          <span className="text-xs text-[var(--muted)]">
            · {new Date(row.created_at).toLocaleString()}
          </span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(t("content.delete.confirm"))) return;
            startTransition(() => deleteContentOutput(row.id, brandId));
          }}
          className="text-[var(--muted)] hover:text-red-400 disabled:opacity-50 text-xs"
          aria-label="delete"
        >
          ✕
        </button>
      </header>

      <div className="px-4 py-3 border-b border-[var(--line)] text-xs text-[var(--muted)] space-y-1">
        <div>
          <span className="text-[var(--foreground)]">{row.prompt}</span>
        </div>
        {row.audience && <div>→ {row.audience}</div>}
      </div>

      <div className="border-b border-[var(--line)]">
        <div className="flex">
          {row.variants.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`flex-1 px-3 py-2 text-xs font-mono tracking-widest transition ${
                active === i
                  ? "bg-[var(--accent)] text-[var(--background)] font-bold"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] bg-[var(--surface-2)]"
              }`}
            >
              {t("content.variant")} {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{variant}</div>
        <CopyButton text={variant} />
      </div>
    </li>
  );
}

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // ignore
        }
      }}
      className={`text-xs px-3 py-1.5 border transition ${
        copied
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      }`}
    >
      {copied ? t("content.copied") : t("content.copy")}
    </button>
  );
}
