import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BrandStatusToggle } from "../brand-status-toggle";
import { ScheduleView } from "./schedule-view";

export default async function SchedulePage({
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

  const [
    { data: posts },
    { data: templates },
    { data: connection },
  ] = await Promise.all([
    supabase
      .from("scheduled_posts")
      .select("id, text, scheduled_at, status, sent_at, sent_post_id, error_message, template_id, created_at")
      .eq("brand_id", brand.id)
      .order("scheduled_at", { ascending: false })
      .limit(100),
    supabase
      .from("post_templates")
      .select("id, name, prompt, recurrence, weekday, time_of_day, next_run_at, active, created_at")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("social_connections")
      .select("username")
      .eq("brand_id", brand.id)
      .eq("platform", "threads")
      .maybeSingle(),
  ]);

  const t = await getServerT();

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
              <Link href={`/brand/${brand.id}`} className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]">
                {t("reports.chat")}
              </Link>
              <Link href={`/brand/${brand.id}/brain`} className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]">
                BRAIN
              </Link>
              <Link href={`/brand/${brand.id}/data`} className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]">
                {t("data.nav")}
              </Link>
              <Link href={`/brand/${brand.id}/content`} className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]">
                {t("content.nav")}
              </Link>
              <Link href={`/brand/${brand.id}/monitor`} className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]">
                {t("monitor.nav")}
              </Link>
              <Link
                href={`/brand/${brand.id}/schedule`}
                className="px-3 py-1.5 border-b-2 border-[var(--accent)] text-[var(--accent)]"
              >
                SCHEDULE
              </Link>
              <Link href={`/brand/${brand.id}/reports`} className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]">
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
            SCHEDULE · {(brand.name as string).toUpperCase()}
          </div>
          <h2 className="mt-2 text-2xl md:text-3xl font-bold">排程發文</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            預約一次或多次 Threads 貼文，或設定模板讓 AI 依品牌語氣每日／每週自動產出貼文。
          </p>
        </div>

        <ScheduleView
          brandId={brand.id}
          threadsUsername={connection?.username as string | null ?? null}
          posts={(posts ?? []).map((p) => ({
            id: p.id as string,
            text: p.text as string,
            scheduled_at: p.scheduled_at as string,
            status: p.status as string,
            sent_at: (p.sent_at as string | null) ?? null,
            sent_post_id: (p.sent_post_id as string | null) ?? null,
            error_message: (p.error_message as string | null) ?? null,
            template_id: (p.template_id as string | null) ?? null,
          }))}
          templates={(templates ?? []).map((tp) => ({
            id: tp.id as string,
            name: tp.name as string,
            prompt: tp.prompt as string,
            recurrence: tp.recurrence as "daily" | "weekly",
            weekday: (tp.weekday as number | null) ?? null,
            time_of_day: tp.time_of_day as string,
            next_run_at: tp.next_run_at as string,
            active: tp.active as boolean,
          }))}
        />
      </section>
    </main>
  );
}
