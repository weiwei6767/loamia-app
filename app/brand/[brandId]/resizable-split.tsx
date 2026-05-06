"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "loamia.rightChatWidth";
const MIN = 320;
const MAX = 720;
const DEFAULT = 400;

export function ResizableSplit({
  children,
  rightContent,
}: {
  children: React.ReactNode;
  rightContent: React.ReactNode;
}) {
  const [chatWidth, setChatWidth] = useState(DEFAULT);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const draggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load persisted width
  useEffect(() => {
    setHydrated(true);
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n) && n >= MIN && n <= MAX) setChatWidth(n);
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, String(chatWidth));
  }, [chatWidth, hydrated]);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = rect.right - e.clientX;
      const clamped = Math.max(MIN, Math.min(MAX, next));
      setChatWidth(clamped);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden h-full relative">
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>

      {/* xl+: inline resizable chat */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onMouseDown}
        onDoubleClick={() => setChatWidth(DEFAULT)}
        className="hidden xl:block w-1 cursor-col-resize bg-[var(--line)] hover:bg-[var(--accent)]/40 transition shrink-0"
        title="拖曳調整寬度（雙擊重設）"
      />
      <aside
        className="border-l border-[var(--line)] overflow-hidden hidden xl:flex flex-col bg-[var(--surface)]/40 shrink-0"
        style={{ width: hydrated ? `${chatWidth}px` : `${DEFAULT}px` }}
      >
        {rightContent}
      </aside>

      {/* < xl: floating button + slide-out drawer */}
      {!drawerOpen && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="xl:hidden fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full bg-[var(--accent)] text-[var(--background)] shadow-2xl flex items-center justify-center text-xl font-bold hover:scale-110 active:scale-95 transition"
          aria-label="開啟 Brand Brain 對話"
          title="開啟 Brand Brain"
        >
          🧠
        </button>
      )}

      {drawerOpen && (
        <div
          className="xl:hidden fixed inset-0 z-40 flex"
          onClick={() => setDrawerOpen(false)}
        >
          <div className="flex-1" />
          <aside
            className="w-full sm:max-w-md flex flex-col bg-[var(--background)] border-l-2 border-[var(--accent)] shadow-2xl"
            style={{ animation: "slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-[var(--line)] flex items-center justify-between gap-2 shrink-0">
              <span className="font-mono text-[10px] tracking-widest text-[var(--accent)]">
                🧠 BRAND BRAIN
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-lg shrink-0"
                aria-label="close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">{rightContent}</div>
          </aside>
        </div>
      )}
    </div>
  );
}
