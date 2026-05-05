import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BrandStatusToggle } from "../brand-status-toggle";
import { MonitorView } from "./monitor-view";

type MonitorRow = {
  id: string;
  source_text: string;
  source_type: string | null;
  tone: string | null;
  suggestions: string[];
  threads_url: string | null;
  created_at: string;
  picked_index: number | null;
  sent_text: string | null;
  sent_at: string | null;
  sent_platform: string | null;
  outcome: string | null;
};

export default async function MonitorPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, status")
    .eq("id", brandId)
    .single();
  if (!brand) notFound();

  const [{ data: rows }, { data: connection }] = await Promise.all([
    supabase
      .from("monitor_replies")
      .select("id, source_text, source_type, tone, suggestions, threads_url, created_at, picked_index, sent_text, sent_at, sent_platform, outcome")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("social_connections")
      .select("username, platform_user_id")
      .eq("brand_id", brand.id)
      .eq("platform", "threads")
      .maybeSingle(),
  ]);

  const t = await getServerT();
  const history: MonitorRow[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    source_text: r.source_text as string,
    source_type: (r.source_type as string | null) ?? null,
    tone: (r.tone as string | null) ?? null,
    suggestions: (r.suggestions as string[] | null) ?? [],
    threads_url: (r.threads_url as string | null) ?? null,
    created_at: r.created_at as string,
    picked_index: (r.picked_index as number | null) ?? null,
    sent_text: (r.sent_text as string | null) ?? null,
    sent_at: (r.sent_at as string | null) ?? null,
    sent_platform: (r.sent_platform as string | null) ?? null,
    outcome: (r.outcome as string | null) ?? null,
  }));

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 md:px-6 py-4 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/dashboard"
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
            >
              {t("brand.back")}
            </Link>
            <div className="min-w-0">
              <div className="text-xs font-mono tracking-widest text-[var(--accent)]">
                {t("brand.label")}
              </div>
              <h1 className="text-lg font-bold truncate">{brand.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1 text-xs font-mono">
              <Link
                href={`/brand/${brand.id}`}
                className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                {t("reports.chat")}
              </Link>
              <Link
                href={`/brand/${brand.id}/data`}
                className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                {t("data.nav")}
              </Link>
              <Link
                href={`/brand/${brand.id}/content`}
                className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                {t("content.nav")}
              </Link>
              <Link
                href={`/brand/${brand.id}/monitor`}
                className="px-3 py-1.5 border-b-2 border-[var(--accent)] text-[var(--accent)]"
              >
                {t("monitor.nav")}
              </Link>
              <Link
                href={`/brand/${brand.id}/reports`}
                className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                {t("reports.nav")}
              </Link>
            </nav>
            <BrandStatusToggle
              brandId={brand.id}
              status={brand.status as "active" | "archived"}
            />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl w-full px-4 md:px-6 py-10 space-y-8">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
            {t("monitor.nav")} · {brand.name.toUpperCase()}
          </div>
          <h2 className="mt-2 text-2xl md:text-3xl font-bold">{t("monitor.title")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("monitor.subtitle")}</p>
        </div>

        <MonitorView
          brandId={brand.id}
          history={history}
          connection={
            connection
              ? {
                  username: (connection.username as string | null) ?? null,
                  platform_user_id: connection.platform_user_id as string,
                }
              : null
          }
        />
      </section>
    </main>
  );
}
