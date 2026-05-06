import Link from "next/link";
import { cookies } from "next/headers";

export const metadata = {
  title: "規則與運作 — Loamia",
  description: "Loamia 軟體規則、AI 行為準則、資料流向、法規遵循",
};

export default async function RulesPage() {
  const c = await cookies();
  const locale = c.get("loamia.locale")?.value === "en" ? "en" : "zh";
  return locale === "en" ? <RulesEN /> : <RulesZH />;
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
            <Link href="/rules" className="text-[var(--accent)]">
              {locale === "en" ? "Rules" : "規則"}
            </Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)]">
              {locale === "en" ? "Privacy" : "隱私權"}
            </Link>
            <Link href="/terms" className="hover:text-[var(--foreground)]">
              {locale === "en" ? "Terms" : "條款"}
            </Link>
            <Link href="/data-deletion" className="hover:text-[var(--foreground)]">
              {locale === "en" ? "Delete Data" : "資料刪除"}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold border-l-2 border-[var(--accent)] pl-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function RulesZH() {
  return (
    <Shell locale="zh">
      <article className="mx-auto max-w-3xl px-4 md:px-6 py-12 space-y-8 text-sm leading-relaxed">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">RULES &amp; HOW IT WORKS</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold">Loamia 規則與運作</h1>
          <p className="mt-3 text-xs text-[var(--muted)] font-mono">最後更新：2026 年 5 月 7 日</p>
        </div>

        <div className="border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-4 text-sm leading-relaxed">
          這頁用白話解釋 Loamia 怎麼運作、你的資料怎麼流向、AI 在做什麼、什麼會傳出網路、什麼不會。
          法律條文細節在 <Link href="/privacy" className="text-[var(--accent)] underline">隱私權政策</Link> 與{" "}
          <Link href="/terms" className="text-[var(--accent)] underline">服務條款</Link>。
        </div>

        <Section title="1. 你的資料儲存在哪？">
          <p>Loamia 使用兩個第三方基礎設施：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase（PostgreSQL 資料庫 + 檔案儲存）</strong>：你的帳戶、品牌、文件、向量索引、聊天紀錄都儲存在這。資料中心位於 AWS Tokyo / 新加坡區域。</li>
            <li><strong>Vercel（應用程式託管）</strong>：執行 Loamia 的 web 應用，本身不持久儲存你的內容資料。</li>
          </ul>
          <p>
            我們透過 <strong>Row Level Security (RLS)</strong> 在資料庫層強制執行多租戶資料隔離——
            <strong>每個 agency 只能讀寫自己 agency 內的品牌與資料</strong>，其他人就算技術上連上資料庫也讀不到你的內容。
          </p>
        </Section>

        <Section title="2. 你的資料會傳給哪些 AI 服務？">
          <p>為了讓 AI 工作，必要時會把相關資料傳給以下服務：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Anthropic Claude</strong>（生成回答、文案、報表、回覆建議）：傳送的內容包含你的提問、對話歷史、相關片段（透過 RAG 檢索的文件段落）、Brand Brain 三層記憶。
            </li>
            <li>
              <strong>OpenAI Embeddings</strong>（向量化）：傳送的內容是你上傳文件的純文字段落，用於建立向量索引以供 RAG 查詢。
            </li>
          </ul>
          <p>
            <strong>合約承諾</strong>：兩家服務商 API 模式皆不會把你的資料用於模型訓練。資料用於即時推論後即丟棄，不會公開、不會被搜尋引擎索引、不會分享給第三方。
          </p>
        </Section>

        <Section title="3. 哪些資料絕對不會傳到外網？">
          <ul className="list-disc pl-5 space-y-1">
            <li>你的密碼（雜湊儲存在 Supabase Auth）</li>
            <li>OAuth Access Token（加密儲存在 Supabase）</li>
            <li>你品牌的 Brand Identity 4 欄位（定位、目標受眾、語氣、禁忌詞）</li>
            <li>你的 KOL 名單聯絡資料、合作費率、合作備註</li>
            <li>你的競品分析內容</li>
            <li>你的 Winning Memory（成功回覆、成交模式）</li>
          </ul>
          <p>
            這些不會被當作網路搜尋字串傳到 Google / DuckDuckGo / 其他搜尋引擎，也不會被分享給其他客戶。
          </p>
        </Section>

        <Section title="4. AI 上網查資料時的規則">
          <p>
            Loamia Brand Brain Chat 具備 <strong>web_search</strong> 與 <strong>web_fetch</strong> 兩個上網工具。AI 上網時遵循以下強制規則（寫在系統 prompt 內）：
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>查詢字串只能是公開可知的一般知識性問題</strong>（例：「台北手搖飲市場 2025 趨勢」、「Threads 演算法分析 2026」）</li>
            <li><strong>絕不包含</strong>：你的品牌名稱（除非該品牌名稱已是公開資訊）、客戶聯絡資料、合作費率、內部成交數據、Brand Identity 細節、未公開檔期、財務數字</li>
            <li>使用者只要說「查 XX 競品」，AI 應該搜尋的是該品牌的「公開描述 / 行業類別」，不是你給的內部評估</li>
            <li>使用者貼 URL 要求抓取分析，AI 才會呼叫 web_fetch；不會主動爬使用者沒提到的網站</li>
            <li>抓取的網頁內容只在當次推論使用，不長期儲存（除非你勾選「同時保存到 DATA」選項）</li>
          </ul>
        </Section>

        <Section title="5. AI 自動發文機制">
          <p>SCHEDULE 模組可自動發 Threads 貼文 + 留言。規則：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>所有自動發文都需要你**主動授權連接 Threads 帳號**（OAuth）</li>
            <li>每次到時間，AI 用你給的 prompt + Brand Brain 產生內容；你可預覽、修改、鎖定，鎖定後發送的就是該版本</li>
            <li>留言（comments）依你寫的順序回覆在貼文底下</li>
            <li>你隨時可以「⏸ 暫停」或「✕ 刪除」模板，立即停止後續發送</li>
            <li>你斷開 Threads 連接，所有自動發文立即停止（即使模板沒刪）</li>
          </ul>
        </Section>

        <Section title="6. 你可以做什麼來控制資料">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>隨時刪除文件</strong>：DATA 分頁可單檔／批次刪除，刪除即立即從資料庫與儲存移除</li>
            <li><strong>清空 Brand Identity</strong>：BRAIN 分頁可逐欄位清空</li>
            <li><strong>斷開 Threads</strong>：總覽頁的 Threads Connection widget 一鍵斷開</li>
            <li><strong>刪除整個帳號</strong>：寄信至 hello@loamia.xyz，30 天內處理完成</li>
            <li>
              詳細刪除步驟見{" "}
              <Link href="/data-deletion" className="text-[var(--accent)] underline">資料刪除頁</Link>
            </li>
          </ul>
        </Section>

        <Section title="7. AI 內容的免責">
          <p>
            AI 生成的所有內容（報表、文案、回覆建議、KOL Brief、自動發文）：
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>可能不準確、過時、有偏見</strong>。請務必發布前審閱</li>
            <li>不應視為法律、醫療、財務、稅務專業建議</li>
            <li>數據與 KPI 只能來自你提供的資料；AI 不會主動編造數字</li>
            <li>使用 AI 內容造成的後果（行銷活動失敗、客戶申訴、形象受損）由你自行承擔</li>
            <li>建議：重要對外文宣請由具專業判斷能力的人審閱後再發布</li>
          </ul>
        </Section>

        <Section title="8. 訂閱方案規則">
          <p>Loamia 採訂閱制，分四階方案：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Lite</strong> NT$1,490/月：5 個活躍客戶 / 10 個封存</li>
            <li><strong>Starter</strong> NT$3,990/月：10 / 30</li>
            <li><strong>Pro</strong> NT$9,990/月：50 / 100（主力推薦）</li>
            <li><strong>Scale</strong> NT$21,800/月：80 / 200</li>
          </ul>
          <p>
            14 天免費試用、30 天退款保證、Founding Members 前 10 家享 6 個月 5 折。
          </p>
        </Section>

        <Section title="9. 我們不會做的事">
          <ul className="list-disc pl-5 space-y-1">
            <li>不會把你的資料賣給任何第三方</li>
            <li>不會把你的資料用於訓練 AI 模型</li>
            <li>不會向其他客戶展示你的品牌資料</li>
            <li>不會自動代表你發布未經你許可的貼文</li>
            <li>不會在你不知情的情況下變更任何 AI 模板的設定</li>
          </ul>
        </Section>

        <Section title="10. 法律遵循">
          <p>Loamia 遵循以下主要法規：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>台灣個人資料保護法</strong></li>
            <li><strong>歐盟 GDPR</strong>（即使非歐盟使用者也適用相同保護）</li>
            <li><strong>Meta 平台政策</strong>（Threads API 使用規範）</li>
            <li><strong>Anthropic 與 OpenAI 服務條款</strong>（不違反其使用政策）</li>
          </ul>
          <p>適用法律與爭議解決：依中華民國（台灣）法律，台灣台北地方法院為第一審管轄法院。</p>
        </Section>

        <Section title="11. 聯絡 / 申訴 / 通報安全事件">
          <p>單一聯絡管道：<a href="mailto:hello@loamia.xyz" className="text-[var(--accent)] underline">hello@loamia.xyz</a></p>
          <p>包含但不限於：一般詢問、隱私問題、資料存取／刪除請求、安全漏洞通報、商業合作。</p>
        </Section>
      </article>
    </Shell>
  );
}

function RulesEN() {
  return (
    <Shell locale="en">
      <article className="mx-auto max-w-3xl px-4 md:px-6 py-12 space-y-8 text-sm leading-relaxed">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">RULES &amp; HOW IT WORKS</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold">Rules &amp; How It Works</h1>
          <p className="mt-3 text-xs text-[var(--muted)] font-mono">Last updated: May 7, 2026</p>
        </div>

        <div className="border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-4 text-sm leading-relaxed">
          This page explains in plain language how Loamia works, where your data flows, what the AI does, what goes
          to the public internet, and what doesn&apos;t. Legal details are in{" "}
          <Link href="/privacy" className="text-[var(--accent)] underline">Privacy Policy</Link> and{" "}
          <Link href="/terms" className="text-[var(--accent)] underline">Terms of Service</Link>.
        </div>

        <Section title="1. Where is your data stored?">
          <p>Loamia uses two third-party providers:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase</strong> (PostgreSQL + storage): accounts, brands, documents, vector indexes, chat history. Data centers: AWS Tokyo / Singapore.</li>
            <li><strong>Vercel</strong> (app hosting): runs the Loamia web app; does not persist your content data itself.</li>
          </ul>
          <p>
            We enforce <strong>Row Level Security (RLS)</strong> at the database layer for multi-tenant isolation —
            each agency can only read/write its own brands and data, even if a database query somehow leaks.
          </p>
        </Section>

        <Section title="2. Which AI services receive your data?">
          <p>For AI to work, the following providers receive relevant context:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Anthropic Claude</strong> (chat, content, reports, reply suggestions): receives your prompts, chat history, retrieved RAG snippets, Brand Brain three-layer memory.</li>
            <li><strong>OpenAI Embeddings</strong> (vector indexing): receives plain text chunks of uploaded documents to compute embeddings.</li>
          </ul>
          <p>
            <strong>Contractual commitment</strong>: both providers&apos; API tier do not use your data to train models. Data is used for inference and discarded; not made public, not indexed, not shared.
          </p>
        </Section>

        <Section title="3. What never goes to the public internet?">
          <ul className="list-disc pl-5 space-y-1">
            <li>Your password (hashed in Supabase Auth)</li>
            <li>OAuth access tokens (encrypted at rest)</li>
            <li>Your Brand Identity 4 fields (positioning, audience, tone, taboo words)</li>
            <li>Your KOL roster contact info, rates, collaboration notes</li>
            <li>Your competitor analyses</li>
            <li>Your Winning Memory (successful replies, conversion patterns)</li>
          </ul>
          <p>
            None of these are sent as web search queries to Google / DuckDuckGo / other search engines, nor shared with other customers.
          </p>
        </Section>

        <Section title="4. Rules when AI searches the web">
          <p>
            Loamia Brand Brain Chat has <strong>web_search</strong> and <strong>web_fetch</strong> tools. When invoked, AI must follow these mandatory rules (encoded in the system prompt):
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Search queries must be <strong>generic, public-knowledge questions</strong> (e.g., &quot;Taiwan beverage market 2025 trends&quot;, &quot;Threads algorithm analysis 2026&quot;)</li>
            <li>Never include: your brand name (unless already widely public), client contact info, collaboration rates, internal sales numbers, Brand Identity details, unannounced campaigns, financial figures</li>
            <li>If the user asks &quot;research competitors&quot;, AI searches the public category/industry, not the brand internals you provided</li>
            <li>web_fetch is only used when the user explicitly provides a URL; no proactive crawling</li>
            <li>Fetched content is used only for the current inference; not stored long-term unless the user opts to &quot;Save to DATA&quot;</li>
          </ul>
        </Section>

        <Section title="5. Auto-publish mechanics">
          <p>The SCHEDULE module can auto-publish Threads posts + comments. Rules:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>All auto-publishing requires you to actively authorize a Threads OAuth connection</li>
            <li>At fire time, AI generates content with your prompt + Brand Brain; you can preview, edit, lock — when locked, that exact version is sent</li>
            <li>Comments (if specified) are posted in your specified order under the new post</li>
            <li>You can pause/delete templates at any time to stop further sends</li>
            <li>Disconnecting Threads stops all auto-publishing immediately, even if templates exist</li>
          </ul>
        </Section>

        <Section title="6. What you can do to control your data">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Delete documents anytime</strong>: DATA tab — single or batch delete</li>
            <li><strong>Clear Brand Identity</strong>: BRAIN tab — clear fields per-field</li>
            <li><strong>Disconnect Threads</strong>: one-click on the Overview page</li>
            <li><strong>Delete entire account</strong>: email hello@loamia.xyz, processed within 30 days</li>
            <li>
              Step-by-step at{" "}
              <Link href="/data-deletion" className="text-[var(--accent)] underline">data deletion page</Link>
            </li>
          </ul>
        </Section>

        <Section title="7. AI content disclaimer">
          <p>All AI-generated content (reports, copy, replies, KOL briefs, scheduled posts):</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>May be inaccurate, outdated, or biased</strong>. Always review before publishing</li>
            <li>Should not be treated as legal, medical, financial, or tax advice</li>
            <li>Numbers and KPIs come only from data you provide; AI does not invent figures</li>
            <li>Consequences of using AI content (campaign failure, complaints, brand damage) are yours to bear</li>
            <li>Recommendation: critical external content should be reviewed by qualified professionals</li>
          </ul>
        </Section>

        <Section title="8. Subscription rules">
          <p>Loamia is subscription-based, four tiers:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Lite</strong> NT$1,490/mo: 5 active clients / 10 archived</li>
            <li><strong>Starter</strong> NT$3,990/mo: 10 / 30</li>
            <li><strong>Pro</strong> NT$9,990/mo: 50 / 100 (recommended)</li>
            <li><strong>Scale</strong> NT$21,800/mo: 80 / 200</li>
          </ul>
          <p>14-day free trial, 30-day refund guarantee, Founding Members (first 10 paid) get 6 months 50% off.</p>
        </Section>

        <Section title="9. What we will not do">
          <ul className="list-disc pl-5 space-y-1">
            <li>Will not sell your data to any third party</li>
            <li>Will not use your data to train AI models</li>
            <li>Will not show your brand data to other customers</li>
            <li>Will not auto-publish anything you haven&apos;t authorized</li>
            <li>Will not silently change AI template settings without you knowing</li>
          </ul>
        </Section>

        <Section title="10. Legal compliance">
          <p>Loamia complies with:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Taiwan Personal Data Protection Act</strong></li>
            <li><strong>EU GDPR</strong> (same protections applied even to non-EU users)</li>
            <li><strong>Meta Platform Policies</strong> (Threads API usage)</li>
            <li><strong>Anthropic and OpenAI Terms</strong></li>
          </ul>
          <p>Governing law: Republic of China (Taiwan). Court of first instance: Taipei District Court.</p>
        </Section>

        <Section title="11. Contact / complaints / security disclosure">
          <p>Single contact: <a href="mailto:hello@loamia.xyz" className="text-[var(--accent)] underline">hello@loamia.xyz</a></p>
          <p>Including but not limited to: general inquiries, privacy questions, data access/deletion requests, security disclosures, business partnerships.</p>
        </Section>
      </article>
    </Shell>
  );
}
