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

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
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
          const showThinking = pending && isLastAssistant && !m.content;
          return (
            <div key={m.id ?? i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] ${isUser ? "" : "w-full"}`}>
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
