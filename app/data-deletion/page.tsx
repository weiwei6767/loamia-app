import Link from "next/link";
import { cookies } from "next/headers";

export const metadata = {
  title: "Data Deletion — Loamia",
  description: "How to delete your data from Loamia",
};

export default async function DataDeletionPage() {
  const c = await cookies();
  const locale = c.get("loamia.locale")?.value === "en" ? "en" : "zh";
  return locale === "en" ? <DeletionEN /> : <DeletionZH />;
}

function Shell({ locale, children }: { locale: "zh" | "en"; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="text-sm font-bold tracking-wide hover:text-[var(--accent)]">
            ← LOAMIA
          </Link>
          <nav className="flex items-center gap-4 text-xs text-[var(--muted)]">
            <Link href="/rules" className="hover:text-[var(--foreground)]">
              {locale === "en" ? "Rules" : "規則"}
            </Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)]">
              {locale === "en" ? "Privacy" : "隱私權"}
            </Link>
            <Link href="/terms" className="hover:text-[var(--foreground)]">
              {locale === "en" ? "Terms" : "服務條款"}
            </Link>
            <Link href="/data-deletion" className="text-[var(--accent)]">
              {locale === "en" ? "Delete" : "刪除"}
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-[var(--line)] mt-12">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 text-xs text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--foreground)]">
            {locale === "en" ? "← Back to home" : "← 返回首頁"}
          </Link>
        </div>
      </footer>
    </main>
  );
}

function DeletionZH() {
  return (
    <Shell locale="zh">
      <article className="mx-auto max-w-3xl px-4 md:px-6 py-12 space-y-6 text-sm leading-relaxed">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">DATA DELETION</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold">資料刪除說明</h1>
          <p className="mt-3 text-xs text-[var(--muted)] font-mono">最後更新：2026 年 5 月 6 日</p>
        </div>

        <p>
          您可隨時要求刪除存放於 Loamia 的個人資料、品牌資料、以及任何透過 Threads / Meta 整合連接所取得的資料。本頁說明三種刪除方式。
        </p>

        <Section title="方法 1：在應用程式內主動刪除">
          <ol className="list-decimal pl-5 space-y-1">
            <li>登入 <Link href="/dashboard" className="text-[var(--accent)] underline">app.loamia.xyz/dashboard</Link></li>
            <li>進入您要刪除資料的品牌</li>
            <li>到「總覽」頁面 → 找到「🧵 THREADS 連接」區塊 → 點「✕ 斷開連接」</li>
            <li>到「資料」分頁 → 選取所有文件 → 點「批次刪除」</li>
            <li>到「品牌大腦」分頁 → 清空 Brand Identity 所有欄位 → 儲存</li>
          </ol>
          <p className="mt-3">
            這會立即從我們的資料庫移除：所有上傳文件、向量索引、Brand Identity 設定、Threads access token、社群監聽歷史、報表等。
          </p>
        </Section>

        <Section title="方法 2：在 Threads / Meta 端撤銷授權">
          <p>
            撤銷 Threads 授權後，Loamia 持有的 access token 立即失效，無法再代表您操作 Threads。
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>打開 Threads App</li>
            <li>個人頁 → 設定 → 帳號 → 網站權限</li>
            <li>找到 Loamia → 點「撤銷」</li>
          </ol>
          <p className="mt-3">
            撤銷後 30 天內，我們會自動刪除過期 token 與相關快取資料。
          </p>
        </Section>

        <Section title="方法 3：Email 申請完整帳號刪除">
          <p>
            若您要刪除整個 Loamia 帳號（包含所有品牌與所有資料），請寄信至：
          </p>
          <p className="text-sm">
            📧{" "}
            <a href="mailto:hello@loamia.xyz?subject=Account%20Deletion%20Request" className="text-[var(--accent)] underline">
              hello@loamia.xyz
            </a>
          </p>
          <p>主旨建議：「Account Deletion Request」。請於信件內容附上您註冊使用的 Email，協助我們確認身份。</p>
          <p>
            收到請求後我們會於 <strong>30 天內</strong> 完成刪除作業，並回覆確認信。法律或會計義務要求保留之資料（例如交易紀錄）將依法定最低期限保存，並會於回覆信中註明。
          </p>
        </Section>

        <Section title="刪除範圍">
          <ul className="list-disc pl-5 space-y-1">
            <li>帳戶基本資料（Email、姓名）</li>
            <li>所有品牌設定與 Brand Brain 三層記憶</li>
            <li>上傳文件與向量索引</li>
            <li>AI 生成內容、報表、回覆紀錄</li>
            <li>Threads access token 與相關快取</li>
            <li>系統日誌（最後一次登入起 90 天內）</li>
          </ul>
        </Section>

        <Section title="聯絡">
          <p>
            如有任何疑問或需要協助，請聯絡{" "}
            <a href="mailto:hello@loamia.xyz" className="text-[var(--accent)] underline">hello@loamia.xyz</a>。
          </p>
        </Section>
      </article>
    </Shell>
  );
}

function DeletionEN() {
  return (
    <Shell locale="en">
      <article className="mx-auto max-w-3xl px-4 md:px-6 py-12 space-y-6 text-sm leading-relaxed">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">DATA DELETION</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold">Data Deletion Instructions</h1>
          <p className="mt-3 text-xs text-[var(--muted)] font-mono">Last updated: May 6, 2026</p>
        </div>

        <p>
          You can request deletion of your personal data, brand data, and any data obtained through Threads / Meta integrations at any time. Below are three methods.
        </p>

        <Section title="Method 1: Self-Service Deletion in the App">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Sign in at <Link href="/dashboard" className="text-[var(--accent)] underline">app.loamia.xyz/dashboard</Link></li>
            <li>Open the brand whose data you want deleted</li>
            <li>On the Overview page → &quot;🧵 THREADS Connection&quot; section → click &quot;✕ Disconnect&quot;</li>
            <li>Go to DATA tab → select all documents → batch delete</li>
            <li>Go to BRAIN tab → clear all Brand Identity fields → save</li>
          </ol>
          <p className="mt-3">
            This immediately removes from our database: uploaded documents, vector indexes, Brand Identity settings, Threads access tokens, monitor history, reports, etc.
          </p>
        </Section>

        <Section title="Method 2: Revoke from Threads / Meta">
          <p>
            Revoking Threads authorization invalidates Loamia&apos;s stored access token immediately.
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Open the Threads App</li>
            <li>Profile → Settings → Account → Website Permissions</li>
            <li>Find Loamia → tap &quot;Revoke&quot;</li>
          </ol>
          <p className="mt-3">
            Within 30 days of revocation, we automatically delete the expired token and associated cached data.
          </p>
        </Section>

        <Section title="Method 3: Full Account Deletion via Email">
          <p>
            To delete your entire Loamia account (all brands, all data), email:
          </p>
          <p className="text-sm">
            📧{" "}
            <a href="mailto:hello@loamia.xyz?subject=Account%20Deletion%20Request" className="text-[var(--accent)] underline">
              hello@loamia.xyz
            </a>
          </p>
          <p>Subject: &quot;Account Deletion Request&quot;. Include the email used at registration to verify your identity.</p>
          <p>
            We will complete deletion within <strong>30 days</strong> and reply with a confirmation. Data legally required to be retained (e.g., transaction records) will be kept only for the minimum legal duration and disclosed in the confirmation reply.
          </p>
        </Section>

        <Section title="Scope of Deletion">
          <ul className="list-disc pl-5 space-y-1">
            <li>Account basics (email, name)</li>
            <li>All brand settings and Brand Brain three-layer memory</li>
            <li>Uploaded documents and vector indexes</li>
            <li>AI-generated content, reports, reply records</li>
            <li>Threads access tokens and related caches</li>
            <li>System logs (within 90 days of last sign-in)</li>
          </ul>
        </Section>

        <Section title="Contact">
          <p>
            For questions or assistance, contact{" "}
            <a href="mailto:hello@loamia.xyz" className="text-[var(--accent)] underline">hello@loamia.xyz</a>.
          </p>
        </Section>
      </article>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold border-l-2 border-[var(--accent)] pl-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
