export type Locale = "zh" | "en";
export const DEFAULT_LOCALE: Locale = "zh";

export const dict = {
  // Login/Signup
  "auth.subtitle": { zh: "Brand GPT · AI Marketing OS", en: "Brand GPT · AI Marketing OS" },
  "auth.tab.login": { zh: "登入", en: "Sign in" },
  "auth.tab.signup": { zh: "註冊", en: "Sign up" },
  "auth.email": { zh: "EMAIL", en: "EMAIL" },
  "auth.password": { zh: "PASSWORD", en: "PASSWORD" },
  "auth.password.hint": { zh: "至少 8 字", en: "At least 8 characters" },
  "auth.submit.login": { zh: "登入", en: "Sign in" },
  "auth.submit.signup": { zh: "註冊", en: "Sign up" },
  "auth.error.empty": { zh: "請輸入 email 和密碼", en: "Email and password required" },
  "auth.error.short": { zh: "密碼至少 8 字", en: "Password must be at least 8 characters" },

  // Onboarding
  "onboard.step": { zh: "STEP 01 ──", en: "STEP 01 ──" },
  "onboard.title": { zh: "建立你的代理商", en: "Create your agency" },
  "onboard.desc": {
    zh: "這是你的工作空間，所有客戶品牌會放在這個代理商之下。",
    en: "This is your workspace; every client brand lives under this agency.",
  },
  "onboard.field": { zh: "代理商名稱", en: "Agency name" },
  "onboard.placeholder": { zh: "例：我的廣告公司", en: "e.g. My Agency" },
  "onboard.submit": { zh: "建立並繼續 →", en: "Create and continue →" },
  "onboard.creating": { zh: "建立中...", en: "Creating..." },
  "onboard.error.empty": { zh: "請輸入代理商名稱", en: "Agency name required" },
  "onboard.error.fail": { zh: "建立失敗", en: "Failed to create" },

  // Dashboard
  "dashboard.logout": { zh: "登出", en: "Sign out" },
  "dashboard.section": { zh: "BRANDS", en: "BRANDS" },
  "dashboard.title": { zh: "客戶品牌", en: "Client Brands" },
  "dashboard.brand.placeholder": { zh: "新品牌名稱", en: "New brand name" },
  "dashboard.brand.create": { zh: "+ 新增品牌", en: "+ New brand" },
  "dashboard.brand.empty": { zh: "還沒有品牌——上方建一個吧。", en: "No brands yet — create one above." },
  "dashboard.brand.active": { zh: "● 活躍", en: "● Active" },
  "dashboard.brand.archived": { zh: "○ 封存", en: "○ Archived" },
  "dashboard.brand.error": { zh: "請輸入品牌名稱", en: "Brand name required" },

  // Brand workspace
  "brand.back": { zh: "← 返回", en: "← Back" },
  "brand.label": { zh: "BRAND", en: "BRAND" },
  "brand.status.active": { zh: "● 活躍", en: "● Active" },
  "brand.status.archived": { zh: "○ 已封存", en: "○ Archived" },
  "brand.threads": { zh: "THREADS", en: "THREADS" },
  "brand.thread.new": { zh: "+ 新對話", en: "+ New chat" },
  "brand.thread.empty": { zh: "還沒有對話", en: "No conversations yet" },
  "brand.thread.delete.confirm": { zh: "確定刪除這個對話？", en: "Delete this conversation?" },
  "brand.upload": { zh: "UPLOAD", en: "UPLOAD" },
  "brand.upload.button": { zh: "上傳並處理", en: "Upload & process" },
  "brand.upload.processing": { zh: "處理中...", en: "Processing..." },
  "brand.upload.help": { zh: "支援 .txt / .md / .pdf / .docx，50MB 內", en: ".txt / .md / .pdf / .docx, up to 50MB" },
  "brand.upload.error.choose": { zh: "請選擇檔案", en: "Please choose a file" },
  "brand.upload.error.size": { zh: "檔案不能超過 50MB", en: "File must be under 50MB" },
  "brand.documents": { zh: "DOCUMENTS", en: "DOCUMENTS" },
  "brand.doc.empty": { zh: "還沒有文件", en: "No documents yet" },
  "brand.doc.ready": { zh: "● 已處理", en: "● Ready" },
  "brand.doc.processing": { zh: "● 處理中", en: "● Processing" },
  "brand.doc.error": { zh: "● 錯誤", en: "● Error" },
  "brand.doc.pending": { zh: "● 待處理", en: "● Pending" },

  // Chat
  "chat.title": { zh: "BRAND GPT", en: "BRAND GPT" },
  "chat.empty.line1.before": { zh: "問我任何關於 ", en: "Ask me anything about " },
  "chat.empty.line1.after": { zh: " 的問題", en: "" },
  "chat.empty.line2": {
    zh: "（先在文件區上傳幾份相關資料，我才能根據資料回答）",
    en: "(Upload a few documents first so I can answer from your data)",
  },
  "chat.placeholder.before": { zh: "問關於 ", en: "Ask about " },
  "chat.placeholder.after": { zh: " 的問題...", en: "..." },
  "chat.send": { zh: "送出", en: "Send" },
  "chat.thinking": { zh: "思考中...", en: "Thinking..." },
  "chat.error.send": { zh: "發送失敗", en: "Send failed" },

  // Citation modal
  "citation.label": { zh: "SOURCE", en: "SOURCE" },
  "citation.similarity.before": { zh: "相似度 ", en: "Similarity " },
  "citation.close": { zh: "關閉", en: "Close" },

  // Settings
  "settings.label": { zh: "設定", en: "Settings" },
  "settings.theme": { zh: "主題", en: "Theme" },
  "settings.theme.dark": { zh: "夜間", en: "Dark" },
  "settings.theme.light": { zh: "白天", en: "Light" },
  "settings.lang": { zh: "語言", en: "Language" },
  "settings.lang.zh": { zh: "中文", en: "中文" },
  "settings.lang.en": { zh: "EN", en: "EN" },
} as const;

export type DictKey = keyof typeof dict;

export function translate(key: DictKey, locale: Locale): string {
  return dict[key][locale];
}
