"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";

type Item = {
  href: (b: string) => string;
  label: string;
  icon: string;
  matchExact?: boolean;
};

export function BrandSidebar({ brandId }: { brandId: string }) {
  const pathname = usePathname() ?? "";
  const { t } = useI18n();

  const items: Item[] = [
    { href: (b) => `/brand/${b}`, label: t("nav.overview"), icon: "🏠", matchExact: true },
    { href: (b) => `/brand/${b}/brain`, label: t("nav.brain"), icon: "🧠" },
    { href: (b) => `/brand/${b}/data`, label: t("data.nav"), icon: "📁" },
    { href: (b) => `/brand/${b}/content`, label: t("content.nav"), icon: "✏️" },
    { href: (b) => `/brand/${b}/monitor`, label: t("monitor.nav"), icon: "🌊" },
    { href: (b) => `/brand/${b}/schedule`, label: t("nav.schedule"), icon: "📅" },
    { href: (b) => `/brand/${b}/kol`, label: t("nav.kol"), icon: "🤝" },
    { href: (b) => `/brand/${b}/reports`, label: t("reports.nav"), icon: "📊" },
  ];

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {items.map((it) => {
        const href = it.href(brandId);
        const active = it.matchExact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-mono tracking-wide transition ${
              active
                ? "bg-[var(--accent)]/10 border-l-2 border-[var(--accent)] text-[var(--accent)]"
                : "border-l-2 border-transparent text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            }`}
          >
            <span className="text-base shrink-0">{it.icon}</span>
            <span className="truncate">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
