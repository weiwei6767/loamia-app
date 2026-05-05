import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Activity = {
  id: string;
  kind: "post_sent" | "post_failed" | "post_scheduled" | "content" | "reply" | "report" | "doc";
  title: string;
  detail: string;
  href: string;
  created_at: string;
};

const KIND_META: Record<Activity["kind"], { icon: string; label: string; color: string }> = {
  post_sent: { icon: "✅", label: "發送", color: "text-[var(--accent)]" },
  post_failed: { icon: "❌", label: "失敗", color: "text-red-400" },
  post_scheduled: { icon: "📅", label: "排程", color: "text-[var(--muted)]" },
  content: { icon: "✏️", label: "文案", color: "text-[var(--accent)]" },
  reply: { icon: "💬", label: "回覆", color: "text-[var(--accent)]" },
  report: { icon: "📊", label: "報表", color: "text-[var(--accent)]" },
  doc: { icon: "📁", label: "文件", color: "text-[var(--muted)]" },
};

export default async function BrandHomePage({
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
    .select("id, name, positioning")
    .eq("id", brandId)
    .single();
  if (!brand) notFound();

  // Compute today (UTC midnight; close enough for most users)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const weekAgoIso = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    { count: docsCount },
    { count: reportsCount },
    { count: contentCount },
    { count: pendingPosts },
    { count: monitorCount },
    { count: postsSentToday },
    { count: contentToday },
    { count: repliesToday },
    { count: connectionsCount },
    { data: recentScheduled },
    { data: recentContent },
    { data: recentReplies },
    { data: recentReports },
  ] = await Promise.all([
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("brand_id", brand.id),
    supabase.from("brand_reports").select("id", { count: "exact", head: true }).eq("brand_id", brand.id),
    supabase.from("content_outputs").select("id", { count: "exact", head: true }).eq("brand_id", brand.id),
    supabase
      .from("scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("status", "pending"),
    supabase.from("monitor_replies").select("id", { count: "exact", head: true }).eq("brand_id", brand.id),
    supabase
      .from("scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("status", "sent")
      .gte("sent_at", todayIso),
    supabase
      .from("content_outputs")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .gte("created_at", todayIso),
    supabase
      .from("monitor_replies")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .gte("created_at", todayIso),
    supabase
      .from("social_connections")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id),
    supabase
      .from("scheduled_posts")
      .select("id, text, status, sent_at, scheduled_at, error_message, created_at")
      .eq("brand_id", brand.id)
      .gte("created_at", weekAgoIso)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("content_outputs")
      .select("id, type, prompt, created_at")
      .eq("brand_id", brand.id)
      .gte("created_at", weekAgoIso)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("monitor_replies")
      .select("id, source_text, outcome, created_at")
      .eq("brand_id", brand.id)
      .gte("created_at", weekAgoIso)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("brand_reports")
      .select("id, title, focus, created_at")
      .eq("brand_id", brand.id)
      .gte("created_at", weekAgoIso)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Build unified activity feed
  const activities: Activity[] = [];
  for (const p of recentScheduled ?? []) {
    const status = p.status as string;
    const kind: Activity["kind"] =
      status === "sent" ? "post_sent" : status === "failed" ? "post_failed" : "post_scheduled";
    const time = (p.sent_at as string | null) ?? (p.scheduled_at as string);
    activities.push({
      id: `sp-${p.id}`,
      kind,
      title:
        status === "sent"
          ? "貼文已發送到 Threads"
          : status === "failed"
            ? "貼文發送失敗"
            : "排程貼文",
      detail: ((p.text as string) ?? "").slice(0, 60),
      href: `/brand/${brand.id}/schedule`,
      created_at: time,
    });
  }
  for (const c of recentContent ?? []) {
    activities.push({
      id: `co-${c.id}`,
      kind: "content",
      title: `產出 ${c.type as string} 文案`,
      detail: ((c.prompt as string) ?? "").slice(0, 60),
      href: `/brand/${brand.id}/content`,
      created_at: c.created_at as string,
    });
  }
  for (const r of recentReplies ?? []) {
    activities.push({
      id: `mr-${r.id}`,
      kind: "reply",
      title:
        r.outcome === "converted"
          ? "回覆 → 促成成交 ✓"
          : r.outcome === "replied"
            ? "回覆 → 對方回應"
            : "AI 產出回覆建議",
      detail: ((r.source_text as string) ?? "").slice(0, 60),
      href: `/brand/${brand.id}/monitor`,
      created_at: r.created_at as string,
    });
  }
  for (const rp of recentReports ?? []) {
    activities.push({
      id: `rp-${rp.id}`,
      kind: "report",
      title: "結案報表已生成",
      detail: ((rp.title as string) ?? "").slice(0, 60),
      href: `/brand/${brand.id}/reports/${rp.id}`,
      created_at: rp.created_at as string,
    });
  }
  activities.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const feed = activities.slice(0, 15);

  return (
    <div className="mx-auto max-w-5xl w-full px-4 md:px-6 py-6 space-y-6">
      <div>
        <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
          DASHBOARD · {(brand.name as string).toUpperCase()}
        </div>
        <h2 className="mt-1 text-xl font-bold">{brand.name}</h2>
        {brand.positioning && (
          <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed line-clamp-2">
            {brand.positioning as string}
          </p>
        )}
      </div>

      {/* Today KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCell label="今日已發貼文" value={postsSentToday ?? 0} accent />
        <KpiCell label="今日 AI 文案" value={contentToday ?? 0} />
        <KpiCell label="今日 AI 回覆" value={repliesToday ?? 0} />
        <KpiCell
          label="待發排程"
          value={pendingPosts ?? 0}
          warn={(pendingPosts ?? 0) > 0}
          href={`/brand/${brand.id}/schedule`}
        />
      </div>

      {/* Activity feed */}
      <section className="border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
              ACTIVITY · 最近 7 天
            </div>
            <div className="text-[10px] text-[var(--muted)] font-mono mt-0.5">
              {feed.length} 筆事件
            </div>
          </div>
        </div>
        {feed.length === 0 ? (
          <p className="text-xs text-[var(--muted)] py-6 text-center">
            還沒有活動。試試在右側 Brand Brain 對話中跟 AI 說：「幫我寫一則 IG 貼文」。
          </p>
        ) : (
          <ul className="space-y-2">
            {feed.map((a) => {
              const meta = KIND_META[a.kind];
              return (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="flex items-start gap-3 px-3 py-2 hover:bg-[var(--surface-2)] transition group"
                  >
                    <span className="text-base shrink-0 mt-0.5">{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium ${meta.color}`}>{a.title}</span>
                        <span className="text-[10px] text-[var(--muted)] font-mono">
                          {timeAgo(new Date(a.created_at))}
                        </span>
                      </div>
                      {a.detail && (
                        <div className="mt-1 text-xs text-[var(--muted)] line-clamp-1">
                          {a.detail}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Module summary */}
      <section className="border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="font-mono text-xs tracking-widest text-[var(--accent)] mb-3">
          MODULES
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <ModuleStat label="🧠 BRAIN" stat={brand.positioning ? "已設定" : "未設定"} ok={!!brand.positioning} href={`/brand/${brand.id}/brain`} />
          <ModuleStat label="📁 DATA" stat={`${docsCount ?? 0} 文件`} href={`/brand/${brand.id}/data`} />
          <ModuleStat label="✏️ CONTENT" stat={`${contentCount ?? 0} 次`} href={`/brand/${brand.id}/content`} />
          <ModuleStat label="🌊 MONITOR" stat={`${monitorCount ?? 0} 筆`} href={`/brand/${brand.id}/monitor`} />
          <ModuleStat
            label="📅 SCHEDULE"
            stat={`${pendingPosts ?? 0} 待發`}
            href={`/brand/${brand.id}/schedule`}
            warn={(pendingPosts ?? 0) > 0}
          />
          <ModuleStat label="📊 REPORTS" stat={`${reportsCount ?? 0} 份`} href={`/brand/${brand.id}/reports`} />
        </div>
        <div className="mt-3 text-[10px] text-[var(--muted)] font-mono">
          🧵 Threads 連接：{(connectionsCount ?? 0) > 0 ? "✓ 已連接" : "✕ 尚未連接"}
        </div>
      </section>
    </div>
  );
}

function KpiCell({
  label,
  value,
  accent,
  warn,
  href,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
  href?: string;
}) {
  const inner = (
    <div className={`p-3 border ${warn && value > 0 ? "border-yellow-400/40 bg-yellow-400/5" : "border-[var(--line)] bg-[var(--surface)]"}`}>
      <div className="font-mono text-[10px] tracking-widest text-[var(--muted)] truncate">
        {label}
      </div>
      <div
        className={`mt-1 font-mono font-bold text-2xl ${
          warn && value > 0
            ? "text-yellow-400"
            : accent
              ? "text-[var(--accent)]"
              : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ModuleStat({
  label,
  stat,
  ok,
  warn,
  href,
}: {
  label: string;
  stat: string;
  ok?: boolean;
  warn?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 px-3 py-2 border border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]/50 transition"
    >
      <span className="font-mono text-xs tracking-wide truncate">{label}</span>
      <span
        className={`text-[10px] font-mono shrink-0 ${
          warn ? "text-yellow-400" : ok ? "text-[var(--accent)]" : "text-[var(--muted)]"
        }`}
      >
        {stat}
      </span>
    </Link>
  );
}

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "剛剛";
  if (mins < 60) return `${mins} 分鐘前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小時前`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} 天前`;
  return d.toLocaleDateString();
}
