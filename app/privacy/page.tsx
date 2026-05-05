import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Loamia",
  description: "Loamia 的隱私權政策",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-wide">
            LOAMIA
          </Link>
          <nav className="flex items-center gap-4 text-xs text-[var(--muted)]">
            <Link href="/privacy" className="text-[var(--accent)]">隱私權政策</Link>
            <Link href="/terms" className="hover:text-[var(--foreground)]">服務條款</Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 md:px-6 py-12 space-y-8 text-sm leading-relaxed">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">PRIVACY POLICY</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold">隱私權政策</h1>
          <p className="mt-3 text-xs text-[var(--muted)] font-mono">最後更新：2026 年 5 月 5 日</p>
        </div>

        <section className="space-y-3">
          <p>
            Loamia（以下簡稱「我們」、「本服務」、「Loamia」）尊重並重視您的隱私。本隱私權政策說明當您使用本服務（包括 loamia.xyz、app.loamia.xyz 及相關產品）時，我們如何收集、使用、揭露、儲存與保護您及您客戶的個人資料。
          </p>
          <p>
            使用本服務即表示您同意本政策所述之資料處理方式。若您不同意本政策任何條款，請停止使用本服務。
          </p>
        </section>

        <Section title="1. 我們收集的資訊">
          <p>我們僅收集為提供與改善服務所必要的資訊。資料來源與類別如下：</p>

          <h3 className="font-bold text-base mt-4">1.1 您主動提供的資訊</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>帳戶資料</strong>：電子郵件地址、姓名、密碼（經 hash 加密儲存）、所屬代理商或品牌。</li>
            <li><strong>品牌與專案資料</strong>：您建立之品牌名稱、logo、品牌定位、目標受眾、語氣風格、競品資訊等。</li>
            <li><strong>上傳文件</strong>：您主動上傳之 PDF、Word、Excel、PowerPoint、CSV、TXT 等檔案內容（用於 AI 知識庫建構）。</li>
            <li><strong>客戶內容</strong>：您於本服務內輸入或貼上之社群留言、貼文、品牌素材等。</li>
            <li><strong>付款資訊</strong>：若未來開放付費訂閱，將透過第三方支付服務商處理，本服務本身不儲存信用卡完整號碼。</li>
          </ul>

          <h3 className="font-bold text-base mt-4">1.2 透過第三方授權取得</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Meta / Threads OAuth</strong>：您授權連接 Threads 帳號後，我們會取得您的 Threads 使用者 ID、使用者名稱、長期存取權杖（Access Token）。我們僅用此權杖代表您查詢、發佈或回覆 Threads 內容，並依您的指示為之。
            </li>
            <li>
              <strong>Threads API 內容資料</strong>：包括公開貼文文字、發佈時間、permalink、貼文作者使用者名稱（僅限您透過本服務搜尋或抓取之內容）。
            </li>
          </ul>

          <h3 className="font-bold text-base mt-4">1.3 自動收集的資訊</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>裝置資訊（瀏覽器類型、作業系統、IP 位址）。</li>
            <li>使用紀錄（造訪頁面、操作時間、功能使用次數）。</li>
            <li>Cookies 與類似技術（請見第 8 節）。</li>
          </ul>
        </Section>

        <Section title="2. 我們如何使用您的資訊">
          <p>所收集之資料僅用於下列目的：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>提供、維護並改善本服務之核心功能（AI 對話、報表生成、內容創作、社群監聽與回覆）。</li>
            <li>根據您上傳之品牌文件建立 AI 知識庫，以便產生符合品牌語氣之內容。</li>
            <li>透過您授權的 Threads 帳號，依您指示執行搜尋、發佈、回覆等操作。</li>
            <li>偵測與防範濫用、詐欺及違反本政策或服務條款之行為。</li>
            <li>遵循法律義務、回應主管機關之要求。</li>
            <li>透過電子郵件通知服務更新、安全提醒、政策變更（您可隨時取消訂閱行銷類郵件）。</li>
          </ul>
          <p className="mt-3">
            <strong>我們不會將您的個人資料或品牌資料用於訓練第三方 AI 模型</strong>。
            送入 Anthropic Claude / OpenAI Embedding 之內容僅作即時推論之用，依其各自服務條款不得用於模型訓練。
          </p>
        </Section>

        <Section title="3. 第三方服務與資料處理者">
          <p>本服務於後台使用以下受信任的第三方服務商，您的資料可能會傳送至這些服務商以履行特定功能：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase</strong>（資料庫與身分驗證）— 儲存帳戶、品牌、文件、向量索引等資料。</li>
            <li><strong>Vercel</strong>（應用程式託管）— 提供伺服器運算與檔案儲存。</li>
            <li><strong>Anthropic Claude</strong>（AI 推論）— 處理對話、報表與內容生成請求。</li>
            <li><strong>OpenAI</strong>（向量嵌入）— 將文件內容轉為向量，供語意搜尋使用。</li>
            <li><strong>Meta / Threads</strong>（社群整合）— 處理 OAuth 授權與 Threads 內容操作。</li>
          </ul>
          <p className="mt-3">
            上述服務商皆為國際知名平台，並依其各自之隱私政策處理資料。我們不會將您的資料出售予任何第三方，亦不會用於與本服務無關之目的。
          </p>
        </Section>

        <Section title="4. Threads / Meta 資料專章">
          <p>因應 Meta 平台政策，特別說明 Threads 相關資料之處理方式：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>我們僅在您主動授權後存取您的 Threads 帳號，並僅取得您所授予之權限範圍內資料。</li>
            <li>長期存取權杖（Long-lived Access Token）以加密方式儲存於 Supabase，僅本服務後端可讀取。</li>
            <li>您可隨時於 Loamia Monitor 頁面點選「斷開連接」撤銷授權；亦可於 Threads App 設定 → 網站權限中撤銷我們的應用程式存取權。</li>
            <li>撤銷後，我們會於 30 天內刪除對應的存取權杖與快取資料。</li>
            <li>透過 Threads API 取得之公開貼文資料僅暫存於記憶體中供當次操作使用，不會長期保存於我們的資料庫。</li>
            <li>您透過本服務發佈或回覆之 Threads 內容，依 Meta 服務條款歸屬於您本人，本服務不主張任何權利。</li>
          </ul>
        </Section>

        <Section title="5. 資料儲存地點與保留期間">
          <ul className="list-disc pl-5 space-y-1">
            <li>主要資料中心位於 Supabase 與 Vercel 指定之區域（通常為美國或歐盟），可能涉及跨境傳輸。</li>
            <li>帳戶資料：保存至您主動刪除帳戶為止，或最後一次登入後 24 個月。</li>
            <li>品牌與文件資料：保存至您主動刪除為止。</li>
            <li>Threads 存取權杖：60 天有效，到期前自動更新；斷開連接後 30 天內刪除。</li>
            <li>系統日誌：90 天。</li>
            <li>法律或會計義務所要求之資料保留：依各地法規最低期限。</li>
          </ul>
        </Section>

        <Section title="6. 資料安全">
          <p>我們採取以下技術與組織措施保護您的資料：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>傳輸層加密（HTTPS / TLS 1.3）。</li>
            <li>資料庫層級加密與 Row Level Security（RLS）權限隔離。</li>
            <li>OAuth 存取權杖加密儲存。</li>
            <li>密碼以業界標準演算法（bcrypt / Argon2）雜湊。</li>
            <li>定期安全更新與漏洞掃描。</li>
            <li>最小權限原則：員工僅在必要範圍內存取資料。</li>
          </ul>
          <p className="mt-3">
            然而，網際網路傳輸與電子儲存之絕對安全並不存在。如發生資料外洩事件，我們將依據適用法規於 72 小時內通知您與相關主管機關。
          </p>
        </Section>

        <Section title="7. 您的權利">
          <p>依據適用之資料保護法律（包括 GDPR、台灣個資法），您享有下列權利：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>查閱權</strong>：要求我們確認是否處理您之個人資料，並取得副本。</li>
            <li><strong>更正權</strong>：要求修正錯誤或不完整之資料。</li>
            <li><strong>刪除權</strong>（被遺忘權）：要求刪除個人資料，但法律要求保留者除外。</li>
            <li><strong>限制處理權</strong>：於特定情況下要求限制資料處理。</li>
            <li><strong>資料可攜權</strong>：要求以結構化、常用、可機器讀取之格式接收您的資料。</li>
            <li><strong>反對權</strong>：反對基於合法利益之資料處理。</li>
            <li><strong>撤回同意權</strong>：撤回先前給予之同意，不影響撤回前之合法處理。</li>
            <li><strong>申訴權</strong>：向所在地之資料保護主管機關提出申訴。</li>
          </ul>
          <p className="mt-3">
            行使上述權利請來信至{" "}
            <a href="mailto:privacy@loamia.xyz" className="text-[var(--accent)] underline">
              privacy@loamia.xyz
            </a>
            。我們將於收到請求後 30 日內回覆。
          </p>
        </Section>

        <Section title="8. Cookies 與類似技術">
          <p>本服務使用以下類別之 Cookies：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>必要性 Cookies</strong>：維持登入狀態、CSRF 防護、語言/主題偏好。無此類 Cookie 服務無法運作。</li>
            <li><strong>功能性 Cookies</strong>：記憶您的介面設定（深淺色、語言、上次選取的品牌）。</li>
            <li><strong>分析 Cookies</strong>（未來可能使用）：協助我們了解使用者行為並改善服務。將事先取得您的同意。</li>
          </ul>
          <p className="mt-3">
            您可於瀏覽器設定中拒絕所有 Cookies，但部分功能將無法使用。
          </p>
        </Section>

        <Section title="9. 兒童隱私">
          <p>
            本服務不向未滿 16 歲之個人提供。我們不會故意收集未滿 16 歲使用者之個人資料。若您發現未成年子女向我們提供了個人資料，請立即聯絡我們，我們將盡速刪除。
          </p>
        </Section>

        <Section title="10. 國際資料傳輸">
          <p>
            您的資料可能傳輸至您居住地以外的國家／地區處理（例如美國、歐盟）。我們會確保此等傳輸有適當的法律基礎與保護措施，包括採用標準合約條款（SCCs）或同等機制。
          </p>
        </Section>

        <Section title="11. 政策變更">
          <p>
            我們可能不時更新本政策。重大變更將透過電子郵件或服務內顯著通知方式告知您，並更新本頁頂部之「最後更新」日期。重大變更於通知後 30 日生效；繼續使用本服務即視為接受新政策。
          </p>
        </Section>

        <Section title="12. 聯絡我們">
          <p>
            若您對本政策、資料處理方式或行使權利有任何疑問，請聯絡：
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>電子郵件：<a href="mailto:privacy@loamia.xyz" className="text-[var(--accent)] underline">privacy@loamia.xyz</a></li>
            <li>一般詢問：<a href="mailto:hello@loamia.xyz" className="text-[var(--accent)] underline">hello@loamia.xyz</a></li>
          </ul>
        </Section>
      </article>

      <footer className="border-t border-[var(--line)] mt-12">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>© 2026 Loamia. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[var(--foreground)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--foreground)]">Terms</Link>
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
