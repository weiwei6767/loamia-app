"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CitationModal } from "./citation-modal";
import { useI18n } from "@/lib/i18n/provider";

export type Citation = {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  similarity: number;
};

type ToolEvent = {
  id: string;
  name: string;
  status: "running" | "done";
  input?: unknown;
  result?: unknown;
};

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  toolEvents?: ToolEvent[];
};

type StoredCitation = {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  similarity: number;
};

type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: StoredCitation[] | null;
  created_at: string;
};

export function Chat({
  brandId,
  brandName,
  threadId,
  initialMessages,
}: {
  brandId: string;
  brandName: string;
  threadId: string | null;
  initialMessages: StoredMessage[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>(() =>
    initialMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        citations: (m.citations ?? undefined) as Citation[] | undefined,
      }))
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    setError("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setPending(true);

    let assistantCitations: Citation[] = [];
    let assistantContent = "";
    let newThreadId: string | null = null;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, threadId, content: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no response stream");
      const decoder = new TextDecoder();

      // Add empty assistant message that we'll fill in
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: { type: string; [k: string]: unknown };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }

          if (evt.type === "thread") {
            newThreadId = evt.id as string;
          } else if (evt.type === "citations") {
            assistantCitations = evt.data as Citation[];
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = {
                ...copy[copy.length - 1],
                citations: assistantCitations,
              };
              return copy;
            });
          } else if (evt.type === "text") {
            assistantContent += evt.delta as string;
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = {
                ...copy[copy.length - 1],
                content: assistantContent,
                citations: assistantCitations,
              };
              return copy;
            });
          } else if (evt.type === "tool_call_start") {
            const id = evt.id as string;
            const name = evt.name as string;
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              const events = [...(last.toolEvents ?? []), { id, name, status: "running" as const }];
              copy[copy.length - 1] = { ...last, toolEvents: events };
              return copy;
            });
          } else if (evt.type === "tool_result") {
            const id = evt.id as string;
            const input = evt.input;
            const result = evt.result;
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              const events = (last.toolEvents ?? []).map((e) =>
                e.id === id ? { ...e, status: "done" as const, input, result } : e
              );
              copy[copy.length - 1] = { ...last, toolEvents: events };
              return copy;
            });
          } else if (evt.type === "error") {
            throw new Error((evt.message as string) || "stream error");
          }
        }
      }

      // Update URL if a new thread was created so refresh keeps the conversation
      if (newThreadId && !threadId) {
        router.replace(`/brand/${brandId}?thread=${newThreadId}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("chat.error.send"));
      setMessages((m) => m.slice(0, -1));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-5">
        {messages.length === 0 && (
          <div className="mt-12 text-center text-sm text-[var(--muted)]">
            <div className="font-mono text-xs tracking-widest text-[var(--accent)] mb-3">
              {t("chat.title")}
            </div>
            <p>
              {t("chat.empty.line1.before")}
              <span className="text-[var(--foreground)] font-medium">{brandName}</span>
              {t("chat.empty.line1.after")}
            </p>
            <p className="mt-2 text-xs">{t("chat.empty.line2")}</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const isLastAssistant = !isUser && i === messages.length - 1;
          const hasToolEvents = (m.toolEvents?.length ?? 0) > 0;
          const showThinking = pending && isLastAssistant && !m.content && !hasToolEvents;
          const hasContent = m.content || showThinking;
          return (
            <div key={m.id ?? i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] ${isUser ? "" : "w-full"}`}>
                {hasContent && (
                  <div
                    className={`whitespace-pre-wrap text-sm leading-relaxed px-4 py-3 ${
                      isUser
                        ? "bg-[var(--accent)] text-[var(--background)] font-medium"
                        : "bg-[var(--surface)] border border-[var(--line)]"
                    }`}
                  >
                    {showThinking ? (
                      <span className="inline-flex items-center gap-2 text-[var(--muted)]">
                        <span className="spinner" /> {t("chat.thinking")}
                      </span>
                    ) : (
                      m.content
                    )}
                  </div>
                )}

                {!isUser && m.toolEvents && m.toolEvents.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {m.toolEvents.map((te) => (
                      <ToolEventCard key={te.id} event={te} />
                    ))}
                  </div>
                )}

                {!isUser && m.citations && m.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.citations.map((c, idx) => (
                      <button
                        key={c.id}
                        onClick={() => setOpenCitation(c)}
                        className="text-xs px-2 py-1 bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--accent)] text-[var(--muted)] hover:text-[var(--foreground)] transition"
                        title={c.filename}
                      >
                        [{idx + 1}] {c.filename}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <form onSubmit={send} className="border-t border-[var(--line)] p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`${t("chat.placeholder.before")}${brandName}${t("chat.placeholder.after")}`}
          className="flex-1 border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="bg-[var(--accent)] px-6 py-2.5 text-sm font-bold tracking-wide text-[var(--background)] transition hover:bg-[var(--accent-glow)] disabled:opacity-50 inline-flex items-center gap-2"
        >
          {pending ? <span className="spinner" /> : t("chat.send")}
        </button>
      </form>

      <CitationModal citation={openCitation} onClose={() => setOpenCitation(null)} />
    </div>
  );
}

type ToolMeta = {
  runningLabel: string;
  successLabel: string;
  failLabel: string;
  ctaText: string;
};

const TOOL_META: Record<string, ToolMeta> = {
  generate_report: {
    runningLabel: "🔧 正在生成結案報表...",
    successLabel: "✓ 結案報表已生成",
    failLabel: "✕ 報表生成失敗",
    ctaText: "→ 查看報表",
  },
  generate_content: {
    runningLabel: "🔧 正在生成文案...",
    successLabel: "✓ 已產出 3 個文案版本",
    failLabel: "✕ 文案生成失敗",
    ctaText: "→ 前往 Content Studio",
  },
  generate_reply_suggestions: {
    runningLabel: "🔧 正在思考回覆建議...",
    successLabel: "✓ 已產出 3 版回覆建議",
    failLabel: "✕ 回覆生成失敗",
    ctaText: "→ 前往 Coast Guard",
  },
};

function ToolEventCard({ event }: { event: ToolEvent }) {
  const meta = TOOL_META[event.name] ?? {
    runningLabel: `🔧 ${event.name}...`,
    successLabel: `✓ ${event.name} 完成`,
    failLabel: `✕ ${event.name} 失敗`,
    ctaText: "→ 查看",
  };
  const isRunning = event.status === "running";
  const result = event.result as
    | { ok: true; link?: string; title?: string; variants?: string[]; suggestions?: string[] }
    | { ok: false; error: string }
    | undefined;
  const success = result && "ok" in result && result.ok;
  const errorMsg = result && "ok" in result && !result.ok ? result.error : null;
  const link = success && "link" in result ? result.link : undefined;
  const title = success && "title" in result ? result.title : undefined;
  const variants =
    success && "variants" in result
      ? result.variants
      : success && "suggestions" in result
        ? result.suggestions
        : undefined;

  const label = isRunning ? meta.runningLabel : success ? meta.successLabel : meta.failLabel;

  return (
    <div
      className={`border p-3 text-xs ${
        isRunning
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/5"
          : success
            ? "border-[var(--accent)] bg-[var(--surface-2)]"
            : "border-red-400/40 bg-red-400/5"
      }`}
    >
      <div className="flex items-center gap-2 font-mono tracking-wide">
        {isRunning && <span className="spinner" />}
        <span className={success || isRunning ? "text-[var(--accent)]" : "text-red-400"}>
          {label}
        </span>
      </div>
      {success && title && (
        <div className="mt-2 text-sm font-bold">{title}</div>
      )}
      {success && variants && variants.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {variants.slice(0, 3).map((v, i) => (
            <li
              key={i}
              className="text-xs text-[var(--muted)] line-clamp-2 leading-relaxed pl-3 border-l border-[var(--line)]"
            >
              {v}
            </li>
          ))}
        </ul>
      )}
      {success && link && (
        <a
          href={link}
          className="inline-block text-xs px-3 py-1.5 mt-2 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition"
        >
          {meta.ctaText}
        </a>
      )}
      {errorMsg && (
        <div className="mt-1 text-xs text-red-400 whitespace-pre-wrap">{errorMsg}</div>
      )}
    </div>
  );
}
