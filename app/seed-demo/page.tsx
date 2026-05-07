import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { seedDemoBrand } from "./actions";

export const metadata = {
  title: "Seed Demo · Loamia",
  description: "One-click demo data seed for Meta App Review reviewers",
};

async function runSeed() {
  "use server";
  const result = await seedDemoBrand();
  if (result.ok) redirect(`/brand/${result.brandId}`);
  redirect(`/seed-demo?error=${encodeURIComponent(result.error)}`);
}

export default async function SeedDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/seed-demo");

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-2xl px-4 md:px-6 py-16 space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ← 返回 dashboard
          </Link>
          <div className="mt-4 font-mono text-xs tracking-widest text-[var(--accent)]">
            META APP REVIEW · DEMO SEED
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold">一鍵灌入 Demo 資料</h1>
          <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
            這個頁面是給 Meta App Review 審核員或內部 demo 用的。點下按鈕會在你目前的
            agency 下建立一個全新的「DEMO 手搖飲」品牌，並灌入：
          </p>
        </div>

        <ul className="text-sm space-y-1.5 list-disc pl-5 text-[var(--foreground)]">
          <li>1 個品牌 + 完整 Brand Identity（4 欄位）</li>
          <li>2 份歷史文件（Brand Identity + 過往檔期報告，含向量 embedding）</li>
          <li>5 名 KOL（不同階段：研究中／談判中／已交件／已完成）</li>
          <li>1 個啟用中的排程模板（每天下午 3 點發 Threads）</li>
          <li>2 筆 Monitor 海巡歷史回覆（一筆已回覆 / 一筆已成交）</li>
        </ul>

        <div className="border border-yellow-400/40 bg-yellow-400/5 p-3 text-xs text-yellow-400 leading-relaxed">
          ⚠️ 每次點按鈕都會建立<strong>新的</strong> DEMO brand。如果重複按會有多個。建議只跑一次。
        </div>

        {params.error && (
          <p className="text-xs text-red-400">✕ {params.error}</p>
        )}

        <form action={runSeed}>
          <button
            type="submit"
            className="w-full bg-[var(--accent)] px-6 py-3 text-sm font-bold tracking-wide text-[var(--background)] hover:bg-[var(--accent-glow)] transition"
          >
            🌱 灌入 DEMO 手搖飲品牌
          </button>
        </form>

        <div className="text-[11px] text-[var(--muted)] leading-relaxed font-mono">
          灌完會自動跳轉到該 brand 頁面。embedding 處理約 5-10 秒。
        </div>
      </div>
    </main>
  );
}
