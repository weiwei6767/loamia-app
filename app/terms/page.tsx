import Link from "next/link";
import { cookies } from "next/headers";

export const metadata = {
  title: "Terms of Service — Loamia",
  description: "Loamia Terms of Service / 服務條款",
};

export default async function TermsPage() {
  const c = await cookies();
  const locale = c.get("loamia.locale")?.value === "en" ? "en" : "zh";
  return locale === "en" ? <TermsEN /> : <TermsZH />;
}

function Shell({ locale, children }: { locale: "zh" | "en"; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="text-sm font-bold tracking-wide hover:text-[var(--accent)] transition">
            ← LOAMIA
          </Link>
          <nav className="flex items-center gap-4 text-xs text-[var(--muted)]">
            <Link href="/rules" className="hover:text-[var(--foreground)]">
              {locale === "en" ? "Rules" : "規則"}
            </Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)]">
              {locale === "en" ? "Privacy" : "隱私權"}
            </Link>
            <Link href="/terms" className="text-[var(--accent)]">
              {locale === "en" ? "Terms" : "服務條款"}
            </Link>
            <Link href="/data-deletion" className="hover:text-[var(--foreground)]">
              {locale === "en" ? "Delete" : "刪除"}
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-[var(--line)] mt-12">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>© 2026 Loamia. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-[var(--foreground)]">
              {locale === "en" ? "← Back to home" : "← 返回首頁"}
            </Link>
          </div>
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

function TermsZH() {
  return (
    <Shell locale="zh">
      <article className="mx-auto max-w-3xl px-4 md:px-6 py-12 space-y-8 text-sm leading-relaxed">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">TERMS OF SERVICE</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold">服務條款</h1>
          <p className="mt-3 text-xs text-[var(--muted)] font-mono">最後更新：2026 年 5 月 5 日</p>
        </div>

        <section className="space-y-3">
          <p>歡迎使用 Loamia！本服務條款（以下簡稱「本條款」）為您（以下簡稱「使用者」、「您」）與 Loamia（以下簡稱「我們」、「本服務」）之間具法律拘束力之協議。</p>
          <p><strong>請於使用本服務前仔細閱讀本條款</strong>。註冊帳戶、登入或使用本服務之任何功能，即表示您已閱讀、理解並同意受本條款拘束。若您不同意，請勿使用本服務。</p>
        </section>

        <Section title="1. 服務說明">
          <p>Loamia 是針對廣告代理商與品牌團隊設計之 AI 行銷作業系統（AI Marketing OS），目前提供以下核心模組：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Brand GPT</strong>：以您上傳之品牌文件為知識庫之 AI 對話助手。</li>
            <li><strong>Auto Report</strong>：自動產生符合品牌風格之行銷報表（支援 PDF / DOCX 匯出）。</li>
            <li><strong>Content Studio</strong>：多種內容類型之 AI 文案生成。</li>
            <li><strong>DATA Hub</strong>：品牌素材文件管理與向量化檢索。</li>
            <li><strong>Coast Guard / Monitor</strong>：社群留言監聽與 AI 回覆建議，可選擇性串接 Threads API。</li>
            <li><strong>KOL Network</strong>（規劃中）：KOL 名單與合作管理。</li>
          </ul>
          <p className="mt-3">本服務之具體功能、可用性與規格可能不時調整或新增，我們將於合理時間內告知重大變更。</p>
        </Section>

        <Section title="2. 帳戶註冊與安全">
          <ul className="list-disc pl-5 space-y-1">
            <li>使用者須年滿 18 歲，或於所在司法管轄區具完全民事行為能力。</li>
            <li>註冊時應提供正確、完整、最新之資訊；資訊變更應即時更新。</li>
            <li>每位使用者僅得擁有一個個人帳戶；不得使用他人之身分註冊。</li>
            <li>您對帳戶下之所有活動負完全責任，包括代理商成員與被授權者之操作。</li>
            <li>密碼應妥善保管，不得轉讓或共用。</li>
            <li>發現帳戶遭未授權使用，應立即通知我們：<a href="mailto:hello@loamia.xyz" className="text-[var(--accent)] underline">hello@loamia.xyz</a></li>
          </ul>
        </Section>

        <Section title="3. 訂閱與付費">
          <p>目前 Loamia 處於免費 Beta 階段，所有功能皆免費提供以收集使用者回饋與改善服務。</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>未來可能推出付費方案，將於正式收費前 30 日通知所有使用者。</li>
            <li>免費期間之服務「按現況」提供，可能存在錯誤、限制或服務暫停。</li>
            <li>我們保留隨時調整功能限制（如 AI 用量、儲存空間、API 配額）之權利，惟將盡可能提前公告。</li>
            <li>付費方案啟用後將另行公告詳細條款，包括付款週期、退款政策、自動續訂與升降級規則。</li>
          </ul>
        </Section>

        <Section title="4. 使用規範與禁止行為">
          <p>使用本服務時，您同意 <strong>不得</strong> 從事下列行為：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>違反任何適用之法律、法規或第三方權利。</li>
            <li>上傳含病毒、惡意程式或破壞性元件之內容。</li>
            <li>規避、停用或干擾本服務之安全功能。</li>
            <li>未經授權存取他人帳戶或資料。</li>
            <li>對本服務進行逆向工程、反編譯或試圖取得原始碼，但法律明文允許者除外。</li>
            <li>大量自動化請求（爬蟲、暴力破解、過度頻繁的 API 呼叫）造成服務負擔。</li>
            <li>透過本服務發送垃圾訊息、騷擾、誹謗、煽動暴力或仇恨之內容。</li>
            <li>侵害他人智慧財產權、肖像權、隱私權或個資。</li>
            <li>偽造、誤導性地使用 AI 生成內容（如假新聞、不實評論、深偽影像）。</li>
            <li>違反 Meta、Anthropic、OpenAI 等第三方服務商之使用政策。</li>
            <li>為違法或不當目的（成人內容、賭博、詐欺、武器交易等）使用本服務。</li>
          </ul>
          <p className="mt-3">違反本條款者，我們有權立即停權、刪除帳戶並保留法律追訴權利。</p>
        </Section>

        <Section title="5. 您的內容與授權">
          <ul className="list-disc pl-5 space-y-1">
            <li>您上傳或建立之品牌資料、文件、AI 生成內容（以下統稱「您的內容」）權利歸屬於您。</li>
            <li>為提供服務之必要，您授予我們有限、非專屬、可撤銷、全球性之免授權金授權，僅用於儲存、處理、向您及您指定之代理商成員顯示您的內容。</li>
            <li>本授權於您刪除內容或終止帳戶時自動失效（法律或合法業務需求所要求保留者除外）。</li>
            <li>您應確保上傳之內容不侵害任何第三方權利；若收到第三方之侵權主張，您應自行處理並使我們免於損害。</li>
            <li>我們有權（但無義務）審查內容，於發現違反本條款之內容時，得移除或限制存取。</li>
          </ul>
        </Section>

        <Section title="6. AI 生成內容免責聲明">
          <p>本服務之 AI 模組（包括 Brand GPT、Auto Report、Content Studio、Coast Guard）會生成文字、報表、回覆建議等內容。請注意：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>AI 生成之內容可能不準確、過時、有偏見或具誤導性</strong>。您於採用、發佈或對外傳達前，應自行查證並負最終責任。</li>
            <li>AI 內容不應被視為專業建議（法律、醫療、財務、稅務等）。</li>
            <li>不同次請求可能產生不同結果；無法保證輸出之完全一致性或重現性。</li>
            <li>AI 模型可能因訓練資料之限制，反映社會既存之偏見；我們持續努力減少不當輸出。</li>
            <li>使用 AI 內容所衍生之任何後果（行銷活動失敗、客戶申訴、形象受損等）由您自行承擔。</li>
          </ul>
          <p className="mt-3"><strong>強烈建議您於正式發佈前，由具備專業判斷能力之人員審閱所有 AI 生成內容</strong>。</p>
        </Section>

        <Section title="7. 我們的智慧財產權">
          <ul className="list-disc pl-5 space-y-1">
            <li>本服務之網站、應用程式、原始碼、商標（LOAMIA 字樣與標誌）、設計、文件、提示詞模板等，皆為 Loamia 或授權人所擁有。</li>
            <li>本條款不授予您任何就上述智慧財產權之權利，僅授予您於本條款期間內、依本條款之非專屬、不可轉讓、可撤銷之使用授權。</li>
            <li>未經事先書面同意，您不得複製、修改、散布、出售或租賃本服務之任何部分。</li>
          </ul>
        </Section>

        <Section title="8. 第三方服務與整合">
          <p>本服務整合多個第三方平台（Meta / Threads、Anthropic Claude、OpenAI、Supabase、Vercel 等）。</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>使用此等整合須遵守各服務商之服務條款與政策。</li>
            <li>第三方服務之可用性、定價、功能由各服務商自行決定，我們無法保證其持續提供。</li>
            <li>第三方服務發生中斷、錯誤或變更導致本服務功能受影響，我們不負其責。</li>
            <li>透過 OAuth 授權連接之社群帳號（如 Threads）可隨時於 Loamia 設定或第三方平台中撤銷。</li>
          </ul>
        </Section>

        <Section title="9. 服務之可用性與變更">
          <ul className="list-disc pl-5 space-y-1">
            <li>我們致力於提供穩定服務，但不保證 100% 可用、零錯誤或不中斷。</li>
            <li>計畫性維護將盡可能於離峰時段進行並提前通知。</li>
            <li>緊急修補或安全更新可能無預警執行。</li>
            <li>我們有權於合理理由下隨時新增、修改或停止部分功能。重大變更將提前 30 日通知。</li>
          </ul>
        </Section>

        <Section title="10. 終止">
          <h3 className="font-bold text-base">10.1 您主動終止</h3>
          <p>您可隨時於設定頁面或來信至 <a href="mailto:hello@loamia.xyz" className="text-[var(--accent)] underline">hello@loamia.xyz</a> 要求刪除帳戶。我們將於 30 日內處理（法律要求保留者除外）。</p>
          <h3 className="font-bold text-base mt-4">10.2 我們之終止權</h3>
          <p>於下列情況，我們得不經事先通知終止或暫停您之服務：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>您嚴重違反本條款。</li>
            <li>持續未繳付費（如未來開放收費）。</li>
            <li>長期未使用（最後登入超過 24 個月）。</li>
            <li>因法律或主管機關要求。</li>
            <li>本服務全面停止營運。</li>
          </ul>
          <h3 className="font-bold text-base mt-4">10.3 終止後</h3>
          <p>終止後您將失去對本服務之存取權；本條款中應在終止後繼續適用之條款（如智慧財產、責任限制、適用法律等）將維持效力。</p>
        </Section>

        <Section title="11. 免責聲明">
          <p><strong>本服務以「現況」（AS IS）及「現有可用」（AS AVAILABLE）之基礎提供，不附帶任何明示或默示之保證</strong>，包括但不限於：適售性、特定目的適用性、不侵權、無中斷、無錯誤、無病毒之保證。</p>
          <p>我們不保證 AI 生成內容之準確性、完整性、時效性或適合性。您使用本服務所獲得之任何資訊或內容，皆應自行評估其風險。</p>
        </Section>

        <Section title="12. 責任限制">
          <p>於法律允許之最大範圍內：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>對於任何間接、附隨、特殊、衍生、懲罰性損害（包括但不限於利潤損失、商譽損失、資料損失），不論基於契約、侵權或其他法律理論，我們均不負責。</li>
            <li>我們對您之累計責任總額，不超過您於損害發生前 12 個月內實際支付給我們之費用；若為免費期間，則以新台幣 3,000 元為上限。</li>
            <li>本條款所述之責任限制，於我們具有故意或重大過失之情形下不適用。</li>
          </ul>
        </Section>

        <Section title="13. 賠償">
          <p>您同意賠償並使我們、我們之關係企業、員工、合作夥伴免於因下列原因所致之任何主張、損失、損害、責任、訴訟費用（包括合理律師費）：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>您違反本條款。</li>
            <li>您侵害任何第三方權利（包括智慧財產、隱私、人格權）。</li>
            <li>您之內容（包括上傳之文件、AI 生成後對外發佈之內容）。</li>
            <li>您之違法或不當使用本服務。</li>
          </ul>
        </Section>

        <Section title="14. 適用法律與爭議解決">
          <ul className="list-disc pl-5 space-y-1">
            <li>本條款之解釋與適用，依中華民國（台灣）法律。</li>
            <li>因本條款或本服務所生之爭議，雙方應先以誠信協商解決。</li>
            <li>協商不成者，雙方合意以台灣台北地方法院為第一審管轄法院。</li>
            <li>若您所在地之強制性消費者保護法律與本條款不一致，將優先適用該強制性規定。</li>
          </ul>
        </Section>

        <Section title="15. 一般條款">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>完整協議</strong>：本條款（含隱私權政策）構成您與我們間就本服務之完整協議，取代先前所有口頭或書面協議。</li>
            <li><strong>可分性</strong>：若本條款任一條款被認定為無效或不可執行，其餘條款仍維持效力。</li>
            <li><strong>不放棄</strong>：我們未行使任何條款下之權利，不構成對該權利之放棄。</li>
            <li><strong>轉讓</strong>：未經我們事先書面同意，您不得轉讓本條款下之權利義務；我們得於合併、收購或資產出售時轉讓。</li>
            <li><strong>不可抗力</strong>：因戰爭、天災、罷工、政府行為、網路中斷等不可抗力事件導致之延誤或無法履行，雙方互不負責。</li>
            <li><strong>通知</strong>：我們將以您註冊之電子郵件或服務內公告方式通知您；通知於發送後 24 小時視為送達。</li>
          </ul>
        </Section>

        <Section title="16. 條款變更">
          <p>我們得不時修改本條款。重大變更將以電子郵件或服務內顯著位置通知您，並更新本頁頂部之「最後更新」日期。修訂後之條款將於通知後 30 日生效；繼續使用本服務即視為接受新條款。若您不同意，應於生效前停止使用並關閉帳戶。</p>
        </Section>

        <Section title="17. 聯絡資訊">
          <p>對本條款有疑問，請聯絡：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>電子郵件：<a href="mailto:hello@loamia.xyz" className="text-[var(--accent)] underline">hello@loamia.xyz</a></li>
          </ul>
        </Section>
      </article>
    </Shell>
  );
}

function TermsEN() {
  return (
    <Shell locale="en">
      <article className="mx-auto max-w-3xl px-4 md:px-6 py-12 space-y-8 text-sm leading-relaxed">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">TERMS OF SERVICE</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold">Terms of Service</h1>
          <p className="mt-3 text-xs text-[var(--muted)] font-mono">Last updated: May 5, 2026</p>
        </div>

        <section className="space-y-3">
          <p>Welcome to Loamia! These Terms of Service (&quot;Terms&quot;) form a legally binding agreement between you (&quot;User&quot;, &quot;you&quot;) and Loamia (&quot;we&quot;, &quot;the Service&quot;).</p>
          <p><strong>Please read these Terms carefully before using the Service.</strong> By registering an account, signing in, or using any feature of the Service, you confirm that you have read, understood, and agree to be bound by these Terms. If you do not agree, do not use the Service.</p>
        </section>

        <Section title="1. The Service">
          <p>Loamia is an AI Marketing OS designed for advertising agencies and brand teams. Current core modules:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Brand GPT</strong>: an AI chat assistant grounded in your uploaded brand documents.</li>
            <li><strong>Auto Report</strong>: automatically generates on-brand marketing reports (PDF / DOCX export).</li>
            <li><strong>Content Studio</strong>: AI copy generation across multiple content types.</li>
            <li><strong>DATA Hub</strong>: brand asset document management and vector retrieval.</li>
            <li><strong>Coast Guard / Monitor</strong>: social comment monitoring and AI reply suggestions, with optional Threads API integration.</li>
            <li><strong>KOL Network</strong> (planned): KOL roster and collaboration management.</li>
          </ul>
          <p className="mt-3">Specific features, availability, and specifications may change from time to time; we will provide reasonable notice of material changes.</p>
        </Section>

        <Section title="2. Account Registration and Security">
          <ul className="list-disc pl-5 space-y-1">
            <li>You must be 18 or older, or have full legal capacity in your jurisdiction.</li>
            <li>Provide accurate, complete, current information at registration; keep it updated.</li>
            <li>Each User may have only one individual account; do not register under another person&apos;s identity.</li>
            <li>You are fully responsible for all activity under your account, including agency members and authorized users.</li>
            <li>Keep your password secure; do not transfer or share it.</li>
            <li>Notify us immediately at <a href="mailto:hello@loamia.xyz" className="text-[var(--accent)] underline">hello@loamia.xyz</a> if you suspect unauthorized use.</li>
          </ul>
        </Section>

        <Section title="3. Subscription and Payment">
          <p>Loamia is currently in free Beta; all features are provided free of charge to gather feedback and improve the Service.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Paid plans may launch in the future; we will notify all users at least 30 days before charging begins.</li>
            <li>During the free period the Service is provided &quot;AS IS&quot; and may have errors, limits, or interruptions.</li>
            <li>We reserve the right to adjust feature limits (AI usage, storage, API quota) at any time, with reasonable advance notice where possible.</li>
            <li>Once paid plans launch, additional terms will be published, including billing cycles, refunds, auto-renewal, and upgrade/downgrade rules.</li>
          </ul>
        </Section>

        <Section title="4. Acceptable Use and Prohibited Conduct">
          <p>While using the Service you agree <strong>not to</strong>:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Violate any applicable law, regulation, or third-party right.</li>
            <li>Upload content containing viruses, malware, or destructive components.</li>
            <li>Bypass, disable, or interfere with security features of the Service.</li>
            <li>Access another&apos;s account or data without authorization.</li>
            <li>Reverse engineer, decompile, or attempt to obtain source code, except where expressly permitted by law.</li>
            <li>Place an excessive automated load (scraping, brute force, abusive API frequency).</li>
            <li>Use the Service to send spam, harass, defame, or incite violence or hatred.</li>
            <li>Infringe IP, image, privacy, or personal data rights of others.</li>
            <li>Use AI-generated content deceptively (fake news, fabricated reviews, deepfakes).</li>
            <li>Violate the policies of third-party providers (Meta, Anthropic, OpenAI, etc.).</li>
            <li>Use the Service for illegal or improper purposes (adult content, gambling, fraud, weapons trade, etc.).</li>
          </ul>
          <p className="mt-3">Violations may result in immediate suspension, account deletion, and we reserve all legal remedies.</p>
        </Section>

        <Section title="5. Your Content and Licenses">
          <ul className="list-disc pl-5 space-y-1">
            <li>You retain rights in brand data, documents, and AI-generated content you upload or create (collectively, &quot;Your Content&quot;).</li>
            <li>To provide the Service, you grant us a limited, non-exclusive, revocable, worldwide, royalty-free license to store, process, and display Your Content to you and your designated agency members.</li>
            <li>This license terminates when you delete the content or end your account, except for retention required by law or legitimate business needs.</li>
            <li>You warrant that Your Content does not infringe any third-party rights; if a third party brings an infringement claim, you will handle it and hold us harmless.</li>
            <li>We may (but are not obligated to) review content and remove or restrict access to content that violates these Terms.</li>
          </ul>
        </Section>

        <Section title="6. AI-Generated Content Disclaimer">
          <p>The Service&apos;s AI modules (Brand GPT, Auto Report, Content Studio, Coast Guard) generate text, reports, reply suggestions, etc. Note that:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>AI-generated content may be inaccurate, outdated, biased, or misleading.</strong> You must verify it before adopting, publishing, or communicating externally, and you bear final responsibility.</li>
            <li>AI content is not professional advice (legal, medical, financial, tax, etc.).</li>
            <li>Different requests may produce different outputs; we cannot guarantee full consistency or reproducibility.</li>
            <li>AI models may reflect societal biases due to training data limitations; we continually work to reduce inappropriate output.</li>
            <li>You bear all consequences of relying on AI content (campaign failure, customer complaints, brand damage, etc.).</li>
          </ul>
          <p className="mt-3"><strong>We strongly recommend that AI-generated content be reviewed by qualified professionals before publication.</strong></p>
        </Section>

        <Section title="7. Our Intellectual Property">
          <ul className="list-disc pl-5 space-y-1">
            <li>The Service&apos;s website, application, source code, trademarks (LOAMIA word and logo), design, documentation, prompt templates, etc., are owned by Loamia or its licensors.</li>
            <li>These Terms do not grant you any rights in our IP, only a non-exclusive, non-transferable, revocable license to use the Service per these Terms.</li>
            <li>You may not copy, modify, distribute, sell, or rent any part of the Service without prior written consent.</li>
          </ul>
        </Section>

        <Section title="8. Third-Party Services and Integrations">
          <p>The Service integrates with multiple third-party platforms (Meta / Threads, Anthropic Claude, OpenAI, Supabase, Vercel, etc.).</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use of these integrations is subject to each provider&apos;s terms and policies.</li>
            <li>Availability, pricing, and features of third-party services are determined by those providers; we cannot guarantee continuous availability.</li>
            <li>We are not responsible for Service impacts caused by third-party outages, errors, or changes.</li>
            <li>Connected social accounts (e.g., Threads) authorized via OAuth can be revoked anytime in Loamia settings or on the third-party platform.</li>
          </ul>
        </Section>

        <Section title="9. Availability and Changes to the Service">
          <ul className="list-disc pl-5 space-y-1">
            <li>We strive for stable service but do not guarantee 100% availability, error-free, or uninterrupted operation.</li>
            <li>Planned maintenance will be performed off-peak with advance notice when possible.</li>
            <li>Emergency patches or security updates may occur without notice.</li>
            <li>We may add, modify, or discontinue features for reasonable cause. Material changes will be announced 30 days in advance.</li>
          </ul>
        </Section>

        <Section title="10. Termination">
          <h3 className="font-bold text-base">10.1 Termination by You</h3>
          <p>You may delete your account anytime via settings or by emailing <a href="mailto:hello@loamia.xyz" className="text-[var(--accent)] underline">hello@loamia.xyz</a>. We will process within 30 days, except for data legally required to be retained.</p>
          <h3 className="font-bold text-base mt-4">10.2 Termination by Us</h3>
          <p>We may terminate or suspend the Service without prior notice if:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>You materially breach these Terms.</li>
            <li>Persistent non-payment (after paid plans launch).</li>
            <li>Long-term inactivity (last login &gt; 24 months).</li>
            <li>Required by law or competent authority.</li>
            <li>The Service is fully discontinued.</li>
          </ul>
          <h3 className="font-bold text-base mt-4">10.3 Effect of Termination</h3>
          <p>You will lose access to the Service. Provisions intended to survive (IP, liability limits, governing law, etc.) remain in force.</p>
        </Section>

        <Section title="11. Disclaimers">
          <p><strong>The Service is provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without warranties of any kind</strong>, express or implied, including but not limited to merchantability, fitness for a particular purpose, non-infringement, uninterrupted operation, error-free, or virus-free.</p>
          <p>We do not warrant the accuracy, completeness, timeliness, or suitability of AI-generated content. Evaluate any information or content obtained through the Service at your own risk.</p>
        </Section>

        <Section title="12. Limitation of Liability">
          <p>To the maximum extent permitted by law:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>We are not liable for any indirect, incidental, special, consequential, or punitive damages (including lost profits, lost goodwill, lost data), under contract, tort, or any legal theory.</li>
            <li>Our aggregate liability to you will not exceed the fees actually paid by you in the 12 months preceding the harm; during free periods, capped at NT$3,000.</li>
            <li>The above limits do not apply to our willful misconduct or gross negligence.</li>
          </ul>
        </Section>

        <Section title="13. Indemnification">
          <p>You agree to indemnify and hold harmless us, our affiliates, employees, and partners from any claims, losses, damages, liabilities, and litigation costs (including reasonable attorney&apos;s fees) arising from:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your breach of these Terms.</li>
            <li>Your infringement of any third-party rights (IP, privacy, personality rights).</li>
            <li>Your Content (uploaded documents, AI content published externally, etc.).</li>
            <li>Your illegal or improper use of the Service.</li>
          </ul>
        </Section>

        <Section title="14. Governing Law and Dispute Resolution">
          <ul className="list-disc pl-5 space-y-1">
            <li>These Terms are governed by the laws of the Republic of China (Taiwan).</li>
            <li>Disputes arising from these Terms or the Service shall first be resolved through good-faith negotiation.</li>
            <li>If unresolved, the parties agree to the Taipei District Court of Taiwan as the court of first instance.</li>
            <li>Mandatory consumer-protection laws of your locale prevail to the extent inconsistent with these Terms.</li>
          </ul>
        </Section>

        <Section title="15. General Provisions">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Entire agreement</strong>: these Terms (with the Privacy Policy) constitute the entire agreement and supersede prior agreements.</li>
            <li><strong>Severability</strong>: if any provision is held invalid or unenforceable, the rest remain in effect.</li>
            <li><strong>No waiver</strong>: failure to enforce any provision is not a waiver of that right.</li>
            <li><strong>Assignment</strong>: you may not assign without our prior written consent; we may assign in mergers, acquisitions, or asset sales.</li>
            <li><strong>Force majeure</strong>: neither party is liable for delay or failure due to events beyond reasonable control (war, disaster, strike, government action, network outage, etc.).</li>
            <li><strong>Notices</strong>: we will notify you via the email on file or in-Service announcements; deemed delivered 24 hours after sending.</li>
          </ul>
        </Section>

        <Section title="16. Changes to These Terms">
          <p>We may modify these Terms from time to time. Material changes will be communicated via email or prominent in-Service notice; the &quot;Last updated&quot; date will be revised. Modified Terms take effect 30 days after notice; continued use constitutes acceptance. If you disagree, stop using the Service and close your account before they take effect.</p>
        </Section>

        <Section title="17. Contact">
          <p>For questions about these Terms, contact:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Email: <a href="mailto:hello@loamia.xyz" className="text-[var(--accent)] underline">hello@loamia.xyz</a></li>
          </ul>
        </Section>
      </article>
    </Shell>
  );
}
