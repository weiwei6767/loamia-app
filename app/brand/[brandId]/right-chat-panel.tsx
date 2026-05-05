"use client";

import { useEffect, useRef, useState } from "react";
import { Chat } from "./chat";

type Thread = { id: string; title: string; created_at: string };
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

export function RightChatPanel({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Initial load: fetch threads, select most recent
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/brand/${brandId}/threads`, { cache: "no-store" });
        const data = (await res.json()) as { threads: Thread[] };
        if (cancelled) return;
        setThreads(data.threads ?? []);
        if (data.threads && data.threads.length > 0) {
          await loadThread(data.threads[0].id);
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  // Close popover on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) setShowList(false);
    }
    if (showList) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showList]);

  async function loadThread(id: string) {
    setLoading(true);
    setCurrentId(id);
    try {
      const res = await fetch(`/api/brand/${brandId}/messages?threadId=${id}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { messages: StoredMessage[] };
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
      setShowList(false);
    }
  }

  function startNew() {
    setCurrentId(null);
    setMessages([]);
    setShowList(false);
  }

  async function refreshThreads() {
    try {
      const res = await fetch(`/api/brand/${brandId}/threads`, { cache: "no-store" });
      const data = (await res.json()) as { threads: Thread[] };
      setThreads(data.threads ?? []);
    } catch {
      // ignore
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Thread switcher header */}
      <div ref={popoverRef} className="relative px-3 py-2 border-b border-[var(--line)] flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="flex-1 text-left text-[10px] font-mono tracking-widest text-[var(--muted)] hover:text-[var(--foreground)] transition flex items-center justify-between gap-2"
          title="切換對話歷史"
        >
          <span className="truncate">
            🧵 {threads.length === 0 ? "新對話" : `${threads.length} 筆對話`}
            {currentId && threads.find((t) => t.id === currentId)?.title
              ? ` · ${threads.find((t) => t.id === currentId)!.title.slice(0, 20)}`
              : ""}
          </span>
          <span className="text-[var(--muted)]">{showList ? "▲" : "▼"}</span>
        </button>
        <button
          type="button"
          onClick={startNew}
          className="text-[10px] px-2 py-1 border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition shrink-0"
          title="新對話"
        >
          + 新
        </button>

        {showList && (
          <div className="absolute left-3 right-3 top-full mt-1 max-h-80 overflow-y-auto border border-[var(--line)] bg-[var(--surface)] shadow-2xl z-30">
            {threads.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[var(--muted)]">尚無對話歷史</div>
            ) : (
              <ul>
                {threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => loadThread(t.id)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--surface-2)] transition ${
                        t.id === currentId ? "bg-[var(--accent)]/10 text-[var(--accent)]" : ""
                      }`}
                    >
                      <div className="truncate">{t.title}</div>
                      <div className="text-[9px] text-[var(--muted)] font-mono mt-0.5">
                        {new Date(t.created_at).toLocaleString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-[var(--muted)]">
            <span className="spinner mr-2" /> 載入中
          </div>
        ) : (
          <Chat
            key={currentId ?? "new"}
            brandId={brandId}
            brandName={brandName}
            threadId={currentId}
            initialMessages={messages}
            onThreadCreated={refreshThreads}
          />
        )}
      </div>
    </div>
  );
}
