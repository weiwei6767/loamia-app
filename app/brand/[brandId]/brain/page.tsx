import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BrandStatusToggle } from "../brand-status-toggle";
import { BrainView } from "./brain-view";

export default async function BrainPage({
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
    .select("id, name, status, positioning, target_audience, tone_guide, taboo_words")
    .eq("id", brandId)
    .single();
  if (!brand) notFound();

  const [{ data: intelligence }, { data: winning }] = await Promise.all([
    supabase
      .from("brand_intelligence")
      .select("id, category, title, content, source, created_at")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("winning_patterns")
      .select("id, pattern_type, example_text, context_summary, outcome_score, created_at")
      .eq("brand_id", brand.id)
      .order("outcome_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20),
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
              <Link href={`/brand/${brand.id}/brain`} className="px-3 py-1.5 border-b-2 border-[var(--accent)] text-[var(--accent)]">
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
            BRAND BRAIN · {(brand.name as string).toUpperCase()}
          </div>
          <h2 className="mt-2 text-2xl md:text-3xl font-bold">品牌大腦</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            三層記憶——Identity 我是誰、Market Intelligence 外部世界、Winning Memory 什麼有效。每次 AI 生成都會自動參考。
          </p>
        </div>

        <BrainView
          brandId={brand.id}
          identity={{
            name: brand.name as string,
            positioning: (brand.positioning as string | null) ?? "",
            target_audience: (brand.target_audience as string | null) ?? "",
            tone_guide: (brand.tone_guide as string | null) ?? "",
            taboo_words: (brand.taboo_words as string[] | null) ?? [],
          }}
          intelligence={(intelligence ?? []).map((i) => ({
            id: i.id as string,
            category: i.category as string,
            title: i.title as string,
            content: i.content as string,
            source: (i.source as string | null) ?? null,
            created_at: i.created_at as string,
          }))}
          winning={(winning ?? []).map((w) => ({
            id: w.id as string,
            pattern_type: w.pattern_type as string,
            example_text: w.example_text as string,
            context_summary: (w.context_summary as string | null) ?? null,
            outcome_score: (w.outcome_score as number | null) ?? null,
            created_at: w.created_at as string,
          }))}
        />
      </section>
    </main>
  );
}
