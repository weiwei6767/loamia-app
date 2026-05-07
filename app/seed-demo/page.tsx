import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { seedDemoBrand, deleteAllDemoBrands } from "./actions";

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

async function runDelete() {
  "use server";
  const result = await deleteAllDemoBrands();
  revalidatePath("/seed-demo");
  if (result.ok) {
    redirect(`/seed-demo?msg=${encodeURIComponent(`已刪除 ${result.deleted} 個 DEMO brand`)}`);
  }
  redirect(`/seed-demo?error=${encodeURIComponent(result.error ?? "刪除失敗")}`);
}

export default async function SeedDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string }>;
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

        <div className="border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3 text-xs leading-relaxed">
          ✓ <strong>已內建去重</strong>：如果同個 agency 已存在「DEMO 手搖飲」，按按鈕會直接跳到既有的，不會建立第二個。
        </div>

        {params.error && (
          <p className="text-xs text-red-400">✕ {params.error}</p>
        )}
        {params.msg && (
          <p className="text-xs text-[var(--accent)]">✓ {params.msg}</p>
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

        <div className="border-t border-[var(--line)] pt-6 space-y-3">
          <div className="font-mono text-xs tracking-widest text-[var(--muted)]">
            CLEANUP
          </div>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            如果你之前不小心多按了幾次，下面這個按鈕會把<strong>所有名為「DEMO 手搖飲」</strong>的品牌（含關聯文件、KOL、模板、Monitor 紀錄）一次刪除。請小心使用。
          </p>
          <form action={runDelete}>
            <button
              type="submit"
              className="text-xs px-4 py-2 border border-red-400/60 text-red-400 hover:bg-red-400/10 transition"
            >
              🗑 刪除全部 DEMO 手搖飲
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
