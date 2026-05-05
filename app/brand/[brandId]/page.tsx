import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, name, positioning, target_audience")
    .eq("id", brandId)
    .single();
  if (!brand) notFound();

  // Quick counts for dashboard
  const [
    { count: docsCount },
    { count: reportsCount },
    { count: contentCount },
    { count: pendingPostsCount },
    { count: monitorCount },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id),
    supabase
      .from("brand_reports")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id),
    supabase
      .from("content_outputs")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id),
    supabase
      .from("scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("status", "pending"),
    supabase
      .from("monitor_replies")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id),
  ]);

  const cards = [
    {
      label: "BRAIN",
      desc: "三層記憶架構，定義品牌身份",
      href: `/brand/${brand.id}/brain`,
      stat: brand.positioning ? "✓ 已設定" : "尚未設定",
      ok: !!brand.positioning,
      icon: "🧠",
    },
    {
      label: "DATA",
      desc: "上傳的文件 + 自動爬取",
      href: `/brand/${brand.id}/data`,
      stat: `${docsCount ?? 0} 份文件`,
      ok: (docsCount ?? 0) > 0,
      icon: "📁",
    },
    {
      label: "CONTENT",
      desc: "AI 文案產出（IG/Threads/EDM 等）",
      href: `/brand/${brand.id}/content`,
      stat: `${contentCount ?? 0} 次生成`,
      ok: (contentCount ?? 0) > 0,
      icon: "✏️",
    },
    {
      label: "MONITOR",
      desc: "海巡 + AI 回覆建議",
      href: `/brand/${brand.id}/monitor`,
      stat: `${monitorCount ?? 0} 筆回覆`,
      ok: (monitorCount ?? 0) > 0,
      icon: "🌊",
    },
    {
      label: "SCHEDULE",
      desc: "排程貼文 + AI 自動模板",
      href: `/brand/${brand.id}/schedule`,
      stat: `${pendingPostsCount ?? 0} 筆待發`,
      ok: (pendingPostsCount ?? 0) > 0,
      icon: "📅",
    },
    {
      label: "REPORTS",
      desc: "結案報表自動產生",
      href: `/brand/${brand.id}/reports`,
      stat: `${reportsCount ?? 0} 份報表`,
      ok: (reportsCount ?? 0) > 0,
      icon: "📊",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl w-full px-4 md:px-6 py-8 space-y-6">
      <div>
        <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
          BRAND OVERVIEW
        </div>
        <h2 className="mt-1 text-2xl font-bold">{brand.name}</h2>
        {brand.positioning && (
          <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
            {brand.positioning as string}
          </p>
        )}
      </div>

      <div className="border border-[var(--line)] bg-[var(--surface)]/50 p-4 text-xs text-[var(--muted)] leading-relaxed">
        💡 右側永久顯示 <span className="text-[var(--accent)]">Brand Brain</span>——
        用對話下指令（生報表 / 寫文案 / 回留言），AI 會自動處理並把結果放進對應模組。
        左側為模組列表，可直接點進去做精細操作。
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="border border-[var(--line)] bg-[var(--surface)] p-4 hover:border-[var(--accent)] transition group"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{c.icon}</span>
                <span className="font-mono text-xs tracking-widest text-[var(--accent)]">
                  {c.label}
                </span>
              </div>
              <span className={`text-[10px] font-mono ${c.ok ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>
                {c.stat}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
