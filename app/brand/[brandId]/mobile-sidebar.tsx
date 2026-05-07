"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BrandSidebar } from "./sidebar";

export function MobileSidebarTrigger({ brandId }: { brandId: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center justify-center w-9 h-9 border border-[var(--line)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition shrink-0"
        aria-label="開啟選單"
        title="開啟選單"
      >
        <span className="text-base leading-none">☰</span>
      </button>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <aside
            className="w-64 max-w-[80vw] bg-[var(--background)] border-r-2 border-[var(--accent)] shadow-2xl flex flex-col"
            style={{ animation: "slide-in-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-[var(--line)] flex items-center justify-between gap-2 shrink-0">
              <span className="font-mono text-[10px] tracking-widest text-[var(--accent)]">
                ☰ MENU
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-lg shrink-0"
                aria-label="關閉"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <BrandSidebar brandId={brandId} />
            </div>
          </aside>
          <div className="flex-1 bg-black/50" />
        </div>
      )}
    </>
  );
}
