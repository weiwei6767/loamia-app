"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

type ReportRow = {
  id: string;
  title: string;
  focus: string | null;
  created_at: string;
};

type Group = {
  key: string;
  label: string;
  reports: ReportRow[];
};

function groupByMonth(reports: ReportRow[], locale: "zh" | "en"): Group[] {
  const map = new Map<string, ReportRow[]>();
  for (const r of reports) {
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
        locale === "zh" ? `${y} · ${parseInt(m, 10)} 月` : `${y} · ${monthEn(parseInt(m, 10))}`;
      return { key, label, reports: list };
    });
}

function monthEn(m: number): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? "";
}

export function ReportsList({
  brandId,
  reports,
}: {
  brandId: string;
  reports: ReportRow[];
}) {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? reports.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            (r.focus ?? "").toLowerCase().includes(q)
        )
      : reports;
    return groupByMonth(filtered, locale);
  }, [reports, search, locale]);

  if (reports.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{t("reports.empty")}</p>;
  }

  return (
    <div className="space-y-6">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        type="text"
        placeholder={t("reports.list.search")}
        className="w-full text-sm px-3 py-2.5 border border-[var(--line)] bg-[var(--surface-2)] focus:border-[var(--accent)] focus:outline-none"
      />

      {filteredGroups.length === 0 ? (
        <p className="text-sm text-[var(--muted)] text-center py-6">
          {t("reports.list.no_match")}
        </p>
      ) : (
        filteredGroups.map((g) => (
          <section key={g.key}>
            <header className="flex items-baseline gap-3 mb-3">
              <h3 className="font-mono text-xs tracking-widest text-[var(--accent)]">{g.label}</h3>
              <span className="text-xs text-[var(--muted)]">· {g.reports.length}</span>
              <div className="flex-1 h-px bg-[var(--line)]" />
            </header>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {g.reports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/brand/${brandId}/reports/${r.id}`}
                    className="block border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]/50 hover:bg-[var(--surface-2)] h-full"
                  >
                    <div className="font-medium text-sm leading-snug line-clamp-2">{r.title}</div>
                    <div className="mt-2 text-[11px] text-[var(--muted)] font-mono">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                    {r.focus && (
                      <div className="mt-2 inline-block text-[10px] px-1.5 py-0.5 border border-[var(--line)] text-[var(--muted)] truncate max-w-full">
                        {r.focus}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
