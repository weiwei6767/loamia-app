"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

type Plan = {
  goal: string;
  steps: Array<{ action: string; description: string }>;
  warnings: string[];
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
  onThreadCreated,
}: {
  brandId: string;
  brandName: string;
  threadId: string | null;
  initialMessages: StoredMessage[];
  onThreadCreated?: (newThreadId: string) => void;
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
    setInput("");
    await sendText(text);
  }

  async function sendText(text: string) {
    if (!text || pending) return;
    setError("");
    setMessages((m) => [...m, { role: "user", content: text }]);
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
        if (onThreadCreated) {
          onThreadCreated(newThreadId);
        } else {
          router.replace(`/brand/${brandId}?thread=${newThreadId}`);
          router.refresh();
        }
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
                    className={`text-sm leading-relaxed px-4 py-3 ${
                      isUser
                        ? "bg-[var(--accent)] text-[var(--background)] font-medium whitespace-pre-wrap"
                        : "bg-[var(--surface)] border border-[var(--line)] chat-md"
                    }`}
                  >
                    {showThinking ? (
                      <span className="inline-flex items-center gap-2 text-[var(--muted)]">
                        <span className="spinner" /> {t("chat.thinking")}
                      </span>
                    ) : isUser ? (
                      m.content
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children, ...props }) => (
                            <a
                              {...props}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--accent)] underline hover:text-[var(--accent-glow)]"
                            >
                              {children}
                            </a>
                          ),
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-2">
                              <table className="text-xs border-collapse border border-[var(--line)] w-full">
                                {children}
                              </table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="border border-[var(--line)] px-2 py-1 bg-[var(--surface-2)] font-bold text-left">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-[var(--line)] px-2 py-1 align-top">
                              {children}
                            </td>
                          ),
                          code: ({ className, children, ...props }) => {
                            const inline = !className;
                            return inline ? (
                              <code
                                className="px-1 py-0.5 bg-[var(--surface-2)] text-[var(--accent)] font-mono text-[12px]"
                                {...props}
                              >
                                {children}
                              </code>
                            ) : (
                              <code
                                className="block p-3 bg-[var(--surface-2)] border border-[var(--line)] font-mono text-[12px] overflow-x-auto"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          ul: ({ children }) => (
                            <ul className="list-disc pl-5 space-y-0.5 my-1">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-5 space-y-0.5 my-1">{children}</ol>
                          ),
                          h1: ({ children }) => (
                            <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
                          ),
                          p: ({ children }) => <p className="my-1">{children}</p>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-[var(--accent)] pl-3 my-2 text-[var(--muted)]">
                              {children}
                            </blockquote>
                          ),
                          img: ({ src, alt }) => (
                            <img
                              src={src ?? ""}
                              alt={alt ?? ""}
                              className="max-w-full h-auto my-2 border border-[var(--line)]"
                              loading="lazy"
                            />
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    )}
                  </div>
                )}

                {!isUser && m.toolEvents && m.toolEvents.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {m.toolEvents.map((te) => (
                      <ToolEventCard
                        key={te.id}
                        event={te}
                        onConfirmPlan={() => sendText("✓ 確認，請依此計畫執行")}
                      />
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
  web_search: {
    runningLabel: "🌐 正在搜尋公開網路...",
    successLabel: "✓ 已取得搜尋結果",
    failLabel: "✕ 搜尋失敗",
    ctaText: "",
  },
  web_fetch: {
    runningLabel: "🌐 正在抓取網頁...",
    successLabel: "✓ 已抓取網頁內容",
    failLabel: "✕ 抓取失敗",
    ctaText: "",
  },
};

function ToolEventCard({
  event,
  onConfirmPlan,
}: {
  event: ToolEvent;
  onConfirmPlan?: () => void;
}) {
  // Special render for propose_plan
  if (event.name === "propose_plan") {
    return <PlanCard event={event} onConfirm={onConfirmPlan} />;
  }

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

function PlanCard({
  event,
  onConfirm,
}: {
  event: ToolEvent;
  onConfirm?: () => void;
}) {
  const isRunning = event.status === "running";
  const result = event.result as
    | { ok: true; awaiting_confirmation: boolean; plan: Plan }
    | undefined;
  const plan = result?.plan;
  const [confirmed, setConfirmed] = useState(false);

  if (isRunning) {
    return (
      <div className="border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3 text-xs">
        <div className="flex items-center gap-2 font-mono tracking-wide text-[var(--accent)]">
          <span className="spinner" />
          📋 正在草擬計畫...
        </div>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="border-2 border-[var(--accent)] bg-[var(--surface-2)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] tracking-widest text-[var(--accent)]">
          📋 計畫待確認
        </div>
        {confirmed && (
          <span className="text-[10px] text-[var(--accent)] font-mono">✓ 已送出</span>
        )}
      </div>
      <div className="text-sm font-bold leading-relaxed">{plan.goal}</div>
      <ol className="space-y-1.5">
        {plan.steps.map((s, i) => (
          <li key={i} className="text-xs flex items-start gap-2">
            <span className="font-mono text-[var(--muted)] shrink-0">{i + 1}.</span>
            <div className="min-w-0">
              <span className="font-mono text-[10px] text-[var(--accent)]">[{s.action}]</span>
              <span className="ml-1.5 leading-relaxed">{s.description}</span>
            </div>
          </li>
        ))}
      </ol>
      {plan.warnings && plan.warnings.length > 0 && (
        <div className="border border-yellow-400/40 bg-yellow-400/5 p-2.5 space-y-1">
          {plan.warnings.map((w, i) => (
            <div key={i} className="text-[11px] text-yellow-300 leading-relaxed">
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}
      {!confirmed ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setConfirmed(true);
              onConfirm?.();
            }}
            className="bg-[var(--accent)] px-4 py-2 text-xs font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition inline-flex items-center gap-1.5"
          >
            ✓ 確認執行
          </button>
          <span className="text-[10px] text-[var(--muted)]">或在輸入框打「取消」/「修改」讓 AI 調整</span>
        </div>
      ) : (
        <div className="text-xs text-[var(--muted)]">已送出確認，等 AI 開始執行...</div>
      )}
    </div>
  );
}
