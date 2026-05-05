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
    <div ref={containerRef} className="flex flex-1 overflow-hidden h-full">
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
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
    </div>
  );
}
