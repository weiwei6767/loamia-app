"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

type ToastStatus = "generating" | "done" | "error";
type Toast = {
  id: string;
  label: string;
  status: ToastStatus;
  error?: string;
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

const TYPE_ICON: Record<string, string> = TYPE_OPTIONS.reduce<Record<string, string>>(
  (acc, opt) => {
    acc[opt.key] = opt.icon;
    return acc;
  },
  {}
);

const TOAST_DISMISS_MS = 4500;

function groupByMonth(rows: ContentRow[], locale: "zh" | "en") {
  const map = new Map<string, ContentRow[]>();
  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => {
      const [y, m] = key.split("-");
      const label =
        locale === "zh"
          ? `${y} · ${parseInt(m, 10)} 月`
          : `${y} · ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m,10)-1]}`;
      return { key, label, rows: list };
    });
}

export function ContentView({
  brandId,
  history,
}: {
  brandId: string;
  history: ContentRow[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState<ContentState, FormData>(
    generateContent,
    undefined
  );
  const [type, setType] = useState<string>("ig_post");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingTypeLabel, setPendingTypeLabel] = useState<string>("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Track when generation starts → add "generating" toast
  useEffect(() => {
    if (pending && pendingTypeLabel === "") {
      const tid = crypto.randomUUID();
      setToasts((prev) => [
        ...prev,
        { id: tid, label: t(`content.type.${type}` as never), status: "generating" },
      ]);
      setPendingTypeLabel(tid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // When state changes (success or error) — update toast
  useEffect(() => {
    if (!state) return;
    if (!pendingTypeLabel) return;

    if ("success" in state && state.success) {
      setToasts((prev) =>
        prev.map((t0) =>
          t0.id === pendingTypeLabel
            ? { ...t0, status: "done" as ToastStatus }
            : t0
        )
      );
      const tid = pendingTypeLabel;
      setPendingTypeLabel("");
      setExpandedId(state.outputId);
      router.refresh();
      setTimeout(() => {
        setToasts((prev) => prev.filter((t0) => t0.id !== tid));
      }, TOAST_DISMISS_MS);
    } else if ("error" in state && state.error) {
      setToasts((prev) =>
        prev.map((t0) =>
          t0.id === pendingTypeLabel
            ? { ...t0, status: "error" as ToastStatus, error: state.error }
            : t0
        )
      );
      setPendingTypeLabel("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t0) => t0.id !== id));
  }

  // Filter + group history
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? history.filter((r) => {
          const typeName = TYPE_OPTIONS.find((o) => o.key === r.type);
          return (
            r.prompt.toLowerCase().includes(q) ||
            (r.audience ?? "").toLowerCase().includes(q) ||
            (typeName?.key.toLowerCase().includes(q) ?? false)
          );
        })
      : history;
    return groupByMonth(filtered, locale);
  }, [history, search, locale]);

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

        {state && "error" in state && state.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}

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
      </form>

      {/* History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="font-mono text-xs tracking-widest text-[var(--muted)]">
            {t("content.history")} · {history.length}
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("content.history.empty")}</p>
        ) : (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder={t("content.search")}
              className="w-full text-sm px-3 py-2.5 border border-[var(--line)] bg-[var(--surface-2)] focus:border-[var(--accent)] focus:outline-none"
            />

            {groups.length === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-6">
                {t("content.list.no_match")}
              </p>
            ) : (
              groups.map((g) => (
                <section key={g.key} className="space-y-2">
                  <header className="flex items-baseline gap-3 mb-2">
                    <h3 className="font-mono text-xs tracking-widest text-[var(--accent)]">{g.label}</h3>
                    <span className="text-xs text-[var(--muted)]">· {g.rows.length}</span>
                    <div className="flex-1 h-px bg-[var(--line)]" />
                  </header>
                  <ul className="space-y-2">
                    {g.rows.map((row) => (
                      <HistoryCard
                        key={row.id}
                        row={row}
                        brandId={brandId}
                        expanded={expandedId === row.id}
                        onToggle={() =>
                          setExpandedId((cur) => (cur === row.id ? null : row.id))
                        }
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
      </div>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 space-y-2 max-w-[360px] w-[calc(100vw-2rem)]">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </>
  );
}

function HistoryCard({
  row,
  brandId,
  expanded,
  onToggle,
}: {
  row: ContentRow;
  brandId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(0);
  const variant = row.variants[active] ?? "";
  const icon = TYPE_ICON[row.type] ?? "📄";

  return (
    <li
      className={`border bg-[var(--surface)] transition ${
        expanded ? "border-[var(--accent)]/40" : "border-[var(--line)]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[var(--surface-2)] transition"
      >
        <span className="text-xl shrink-0 mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-widest text-[var(--accent)]">
              {t(`content.type.${row.type}` as never)}
            </span>
            <span className="text-[10px] text-[var(--muted)]">
              · {new Date(row.created_at).toLocaleDateString()} {new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="mt-1 text-sm truncate">{row.prompt}</div>
          {row.audience && (
            <div className="mt-0.5 text-xs text-[var(--muted)] truncate">→ {row.audience}</div>
          )}
        </div>
        <span className="text-[var(--muted)] text-xs shrink-0 mt-1">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--line)]">
          <div className="flex border-b border-[var(--line)]">
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
          <div className="p-4">
            <div className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{variant}</div>
            <div className="flex items-center gap-2">
              <CopyButton text={variant} />
              <button
                type="button"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirm(t("content.delete.confirm"))) return;
                  startTransition(() => deleteContentOutput(row.id, brandId));
                }}
                className="text-xs px-3 py-1.5 border border-[var(--line)] text-[var(--muted)] hover:border-red-400 hover:text-red-400 transition disabled:opacity-50"
              >
                ✕ {pending ? "..." : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
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

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { t } = useI18n();
  const isError = toast.status === "error";
  const isDone = toast.status === "done";
  const isGenerating = toast.status === "generating";

  return (
    <div
      style={{ animation: "toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}
      className={`border bg-[var(--surface)] backdrop-blur-xl shadow-2xl ${
        isError
          ? "border-red-400/50"
          : isDone
            ? "border-[var(--accent)]/50"
            : "border-[var(--line)]"
      }`}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isError ? "bg-red-400" : isDone ? "bg-[var(--accent)]" : "bg-yellow-400"
          }`}
          style={
            isGenerating ? { animation: "pulse-dot 1.4s ease-in-out infinite" } : undefined
          }
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm truncate font-medium">{toast.label}</div>
          <div
            className={`text-xs font-mono mt-0.5 tracking-wide ${
              isError ? "text-red-400" : isDone ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            {isError
              ? `✕ ${toast.error ?? t("common.failed")}`
              : isDone
                ? `✓ ${t("content.toast.success")}`
                : `↻ ${t("content.generating")}`}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm shrink-0"
          aria-label="dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
