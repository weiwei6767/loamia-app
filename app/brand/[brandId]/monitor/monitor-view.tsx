"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  generateReplies,
  deleteMonitorReply,
  postThreadsReply,
  markReplyOutcome,
  type MonitorState,
} from "./actions";
import { useI18n } from "@/lib/i18n/provider";
import { ThreadsSection } from "./threads-section";

type MonitorRow = {
  id: string;
  source_text: string;
  source_type: string | null;
  tone: string | null;
  suggestions: string[];
  threads_url: string | null;
  created_at: string;
  picked_index: number | null;
  sent_text: string | null;
  sent_at: string | null;
  sent_platform: string | null;
  outcome: string | null;
};

type ThreadsConnection = {
  username: string | null;
  platform_user_id: string;
};

type ToastStatus = "generating" | "done" | "error";
type Toast = { id: string; status: ToastStatus; error?: string };
const TOAST_DISMISS_MS = 4500;

function groupByMonth(rows: MonitorRow[], locale: "zh" | "en") {
  const map = new Map<string, MonitorRow[]>();
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
          : `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m,10)-1]} ${y}`;
      return { key, label, rows: list };
    });
}

export function MonitorView({
  brandId,
  history,
  connection,
}: {
  brandId: string;
  history: MonitorRow[];
  connection: ThreadsConnection | null;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, action, pending] = useActionState<MonitorState, FormData>(generateReplies, undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingToastId, setPendingToastId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sourceTextRef = useRef<HTMLTextAreaElement>(null);
  const sourceTypeRef = useRef<HTMLInputElement>(null);
  const threadsUrlRef = useRef<HTMLInputElement>(null);

  // Show toast for OAuth connection result on mount
  useEffect(() => {
    const connected = searchParams.get("threads_connected");
    const errorMsg = searchParams.get("threads_error");
    if (connected) {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, status: "done" }]);
      setTimeout(() => setToasts((prev) => prev.filter((t0) => t0.id !== id)), TOAST_DISMISS_MS);
      router.replace(`/brand/${brandId}/monitor`);
    } else if (errorMsg) {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, status: "error", error: decodeURIComponent(errorMsg) }]);
      router.replace(`/brand/${brandId}/monitor`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fillFromThreadsPost(post: { text?: string; username?: string; permalink?: string }) {
    if (sourceTextRef.current) {
      sourceTextRef.current.value = post.text ?? "";
      sourceTextRef.current.focus();
    }
    if (sourceTypeRef.current) {
      sourceTypeRef.current.value = post.username
        ? `Threads · @${post.username}`
        : "Threads";
    }
    if (threadsUrlRef.current && post.permalink) {
      threadsUrlRef.current.value = post.permalink;
    }
    sourceTextRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  useEffect(() => {
    if (pending && !pendingToastId) {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, status: "generating" }]);
      setPendingToastId(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(() => {
    if (!state || !pendingToastId) return;

    if ("success" in state && state.success) {
      const tid = pendingToastId;
      setToasts((prev) => prev.map((t0) => (t0.id === tid ? { ...t0, status: "done" } : t0)));
      setPendingToastId("");
      setExpandedId(state.replyId);
      router.refresh();
      setTimeout(() => setToasts((prev) => prev.filter((t0) => t0.id !== tid)), TOAST_DISMISS_MS);
    } else if ("error" in state && state.error) {
      const tid = pendingToastId;
      setToasts((prev) =>
        prev.map((t0) => (t0.id === tid ? { ...t0, status: "error", error: state.error } : t0))
      );
      setPendingToastId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t0) => t0.id !== id));
  }

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? history.filter(
          (r) =>
            r.source_text.toLowerCase().includes(q) ||
            (r.source_type ?? "").toLowerCase().includes(q) ||
            (r.tone ?? "").toLowerCase().includes(q)
        )
      : history;
    return groupByMonth(filtered, locale);
  }, [history, search, locale]);

  return (
    <>
      {/* Threads API integration */}
      <ThreadsSection
        brandId={brandId}
        connection={connection}
        onUsePost={fillFromThreadsPost}
      />

      <form
        action={action}
        className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4"
      >
        <input type="hidden" name="brandId" value={brandId} />

        <div>
          <label
            htmlFor="sourceText"
            className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]"
          >
            {t("monitor.source.label")}
          </label>
          <textarea
            ref={sourceTextRef}
            id="sourceText"
            name="sourceText"
            rows={4}
            required
            maxLength={2000}
            placeholder={t("monitor.source.placeholder")}
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="sourceType"
              className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]"
            >
              {t("monitor.type.label")}
            </label>
            <input
              ref={sourceTypeRef}
              id="sourceType"
              name="sourceType"
              type="text"
              maxLength={60}
              placeholder={t("monitor.type.placeholder")}
              className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="tone"
              className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]"
            >
              {t("monitor.tone.label")}
            </label>
            <input
              id="tone"
              name="tone"
              type="text"
              maxLength={120}
              placeholder={t("monitor.tone.placeholder")}
              className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="threadsUrl"
            className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]"
          >
            {t("monitor.threads_url.label")}
          </label>
          <input
            ref={threadsUrlRef}
            id="threadsUrl"
            name="threadsUrl"
            type="url"
            placeholder="https://www.threads.com/@xxx/post/..."
            className="w-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
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
              {t("monitor.generating")}
            </>
          ) : (
            <>+ {t("monitor.generate")}</>
          )}
        </button>
      </form>

      {/* History */}
      <div className="space-y-4">
        <div className="font-mono text-xs tracking-widest text-[var(--muted)]">
          {t("monitor.history")} · {history.length}
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("monitor.history.empty")}</p>
        ) : (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder={t("monitor.search")}
              className="w-full text-sm px-3 py-2.5 border border-[var(--line)] bg-[var(--surface-2)] focus:border-[var(--accent)] focus:outline-none"
            />

            {groups.length === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-6">
                {t("reports.list.no_match")}
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
                      <ReplyCard
                        key={row.id}
                        row={row}
                        brandId={brandId}
                        connected={!!connection}
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

function ReplyCard({
  row,
  brandId,
  connected,
  expanded,
  onToggle,
}: {
  row: MonitorRow;
  brandId: string;
  connected: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(0);
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendError, setSendError] = useState<string>("");
  const reply = row.suggestions[active] ?? "";
  const canSendDirectly = connected && !!row.threads_url;

  async function sendToThreads() {
    if (!row.threads_url || !reply) return;
    if (!confirm(`${t("monitor.send.confirm")}\n\n${reply}`)) return;
    setSendStatus("sending");
    setSendError("");
    const fd = new FormData();
    fd.append("brandId", brandId);
    fd.append("url", row.threads_url);
    fd.append("text", reply);
    fd.append("sourceReplyId", row.id);
    fd.append("pickedIndex", String(active));
    const result = await postThreadsReply(undefined, fd);
    if (result && "success" in result && result.success) {
      setSendStatus("sent");
      setTimeout(() => setSendStatus("idle"), 4000);
    } else if (result && "error" in result) {
      setSendStatus("error");
      setSendError(result.error);
    }
  }

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
        <span className="text-xl shrink-0 mt-0.5">💬</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {row.source_type && (
              <span className="font-mono text-[10px] tracking-widest text-[var(--accent)]">
                {row.source_type}
              </span>
            )}
            <span className="text-[10px] text-[var(--muted)]">
              · {new Date(row.created_at).toLocaleDateString()}{" "}
              {new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {row.tone && (
              <span className="text-[10px] px-1.5 py-0.5 border border-[var(--line)] text-[var(--muted)]">
                {row.tone}
              </span>
            )}
          </div>
          <div className="mt-1 text-sm line-clamp-2">{row.source_text}</div>
        </div>
        <span className="text-[var(--muted)] text-xs shrink-0 mt-1">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--line)]">
          <div className="px-4 py-3 bg-[var(--surface-2)] text-xs text-[var(--muted)] leading-relaxed whitespace-pre-wrap border-b border-[var(--line)]">
            {row.source_text}
          </div>
          <div className="flex border-b border-[var(--line)]">
            {row.suggestions.map((_, i) => (
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
                {t("monitor.suggestion")} {i + 1}
              </button>
            ))}
          </div>
          <div className="p-4">
            <div className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{reply}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <CopyButton text={reply} />
              {canSendDirectly && (
                <button
                  type="button"
                  disabled={sendStatus === "sending"}
                  onClick={sendToThreads}
                  className={`text-xs px-3 py-1.5 border transition disabled:opacity-50 ${
                    sendStatus === "sent"
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : sendStatus === "error"
                        ? "border-red-400 text-red-400"
                        : "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)]"
                  }`}
                >
                  {sendStatus === "sending"
                    ? t("monitor.send.sending")
                    : sendStatus === "sent"
                      ? t("monitor.send.sent")
                      : sendStatus === "error"
                        ? t("monitor.send.failed")
                        : t("monitor.send.button")}
                </button>
              )}
              {row.threads_url && (
                <a
                  href={row.threads_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 border border-[var(--line)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition"
                >
                  {t("monitor.original_post")}
                </a>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirm(t("monitor.delete.confirm"))) return;
                  startTransition(() => deleteMonitorReply(row.id, brandId));
                }}
                className="text-xs px-3 py-1.5 border border-[var(--line)] text-[var(--muted)] hover:border-red-400 hover:text-red-400 transition disabled:opacity-50"
              >
                ✕ {pending ? "..." : t("monitor.delete")}
              </button>
            </div>
            {sendError && (
              <p className="mt-2 text-xs text-red-400">{sendError}</p>
            )}

            {row.sent_at && (
              <FeedbackPanel
                row={row}
                brandId={brandId}
              />
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function FeedbackPanel({
  row,
  brandId,
}: {
  row: MonitorRow;
  brandId: string;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [outcomeLocal, setOutcomeLocal] = useState<string | null>(row.outcome);

  function mark(outcome: "replied" | "ignored" | "converted") {
    setOutcomeLocal(outcome);
    startTransition(() => markReplyOutcome(row.id, brandId, outcome));
  }

  const sentDate = row.sent_at ? new Date(row.sent_at) : null;
  const pickedLabel =
    row.picked_index !== null && row.picked_index !== undefined
      ? `${t("monitor.suggestion")} ${row.picked_index + 1}`
      : "";

  return (
    <div className="mt-3 pt-3 border-t border-[var(--line)] space-y-2">
      <div className="text-[10px] text-[var(--muted)] font-mono">
        ✓ {t("monitor.feedback.sent_at")} {sentDate?.toLocaleString()}
        {pickedLabel ? ` · ${pickedLabel}` : ""}
        {row.sent_platform ? ` · ${row.sent_platform}` : ""}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--muted)]">{t("monitor.feedback.outcome")}：</span>
        {(["replied", "converted", "ignored"] as const).map((o) => (
          <button
            key={o}
            type="button"
            disabled={pending}
            onClick={() => mark(o)}
            className={`text-xs px-2.5 py-1 border transition disabled:opacity-50 ${
              outcomeLocal === o
                ? o === "converted"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)] font-bold"
                  : o === "replied"
                    ? "border-blue-400 text-blue-400"
                    : "border-[var(--muted)] text-[var(--muted)]"
                : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
            }`}
          >
            {t(`monitor.feedback.${o}` as never)}
          </button>
        ))}
      </div>
    </div>
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
          <div className="text-sm truncate font-medium">
            {isError ? "✕" : isDone ? "✓" : "↻"} {t("monitor.title")}
          </div>
          <div
            className={`text-xs font-mono mt-0.5 tracking-wide ${
              isError ? "text-red-400" : isDone ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            {isError
              ? `✕ ${toast.error ?? t("monitor.toast.failed")}`
              : isDone
                ? `✓ ${t("monitor.toast.success")}`
                : `↻ ${t("monitor.generating")}`}
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
