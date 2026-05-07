"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "loamia.rightChatWidth";
const COLLAPSED_KEY = "loamia.rightChatCollapsed";
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
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load persisted width + collapsed state
  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n) && n >= MIN && n <= MAX) setChatWidth(n);
    }
    const c = window.localStorage.getItem(COLLAPSED_KEY);
    if (c === "1") setCollapsed(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, String(chatWidth));
  }, [chatWidth, hydrated]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed, hydrated]);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    setIsDragging(true);
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
      setIsDragging(false);
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

      {/* xl+: inline resizable chat — animated collapse */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onMouseDown}
        onDoubleClick={() => setChatWidth(DEFAULT)}
        className={`hidden xl:block w-1 cursor-col-resize bg-[var(--line)] hover:bg-[var(--accent)]/40 transition-[opacity] duration-300 shrink-0 ${
          collapsed ? "opacity-0 pointer-events-none w-0" : "opacity-100"
        }`}
        title="拖曳調整寬度（雙擊重設）"
      />
      <aside
        className={`border-l border-[var(--line)] overflow-hidden hidden xl:flex flex-col bg-[var(--surface)]/40 shrink-0 relative ${
          isDragging
            ? ""
            : "transition-[width,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        }`}
        style={{
          width: collapsed ? "0px" : hydrated ? `${chatWidth}px` : `${DEFAULT}px`,
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? "none" : "auto",
        }}
        aria-hidden={collapsed}
      >
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="absolute top-3 right-3 z-10 h-8 px-2.5 flex items-center gap-1 bg-[var(--accent)] text-[var(--background)] font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition"
          aria-label="收合對話面板"
          title="收合對話面板"
        >
          <span className="text-base leading-none">›</span>
          <span className="tracking-wider">收合</span>
        </button>
        <div style={{ width: hydrated ? `${chatWidth}px` : `${DEFAULT}px` }} className="flex flex-col flex-1 min-h-0">
          {rightContent}
        </div>
      </aside>

      {/* xl+: floating button when collapsed (with pulse + scale-in animation) */}
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={`hidden xl:flex fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--background)] items-center justify-center text-2xl font-bold transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed
            ? "opacity-100 scale-100 pointer-events-auto shadow-[0_0_0_0_rgba(255,200,0,0.6)] animate-[chat-pulse_2s_ease-in-out_infinite] hover:scale-110 active:scale-95"
            : "opacity-0 scale-50 pointer-events-none"
        }`}
        aria-label="開啟 Brand Brain 對話"
        title="開啟 Brand Brain"
        aria-hidden={!collapsed}
      >
        💬
      </button>

      {/* < xl: floating button + slide-out drawer */}
      {!drawerOpen && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="xl:hidden fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full bg-[var(--accent)] text-[var(--background)] shadow-2xl flex items-center justify-center text-xl font-bold hover:scale-110 active:scale-95 transition"
          aria-label="開啟 Brand Brain 對話"
          title="開啟 Brand Brain"
        >
          💬
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
