import "server-only";
import { anthropic, CHAT_MODEL } from "./anthropic";
import { fetchPage } from "./web-fetch";

export type BrandIdentityAnalysis = {
  brand_name: string | null;
  positioning: string;
  target_audience: string;
  tone_guide: string;
  taboo_words: string[];
};

export type CompetitorAnalysis = {
  relevance_score: number;
  relevance_reason: string;
  is_competitor: boolean;
  title: string;
  content: string;
};

function safeJsonExtract(raw: string): unknown {
  const trimmed = raw.trim();
  // remove ```json fences if present
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

export async function analyzeBrandIdentityFromUrl(
  url: string
): Promise<BrandIdentityAnalysis & { fetchedText: string; pageTitle: string }> {
  const page = await fetchPage(url);
  if (!page.text || page.text.length < 50) {
    throw new Error("page_too_short — 抓不到足夠內容（可能是 JS-rendered 網站）");
  }

  const systemPrompt = `你是 Loamia 的品牌分析師。根據提供的品牌官網內容，輸出**嚴格的 JSON**，描述該品牌的 Brand Identity。

## 輸出 JSON schema（必須完全符合，不可加額外欄位、不可缺欄位）
{
  "brand_name": string | null,        // 品牌名稱；找不到就 null
  "positioning": string,               // 50-150 字描述品牌定位、核心價值、產品/服務本質
  "target_audience": string,           // 50-150 字描述目標受眾輪廓（年齡、職業、興趣、痛點）
  "tone_guide": string,                // 30-100 字描述建議的文案語氣（例：「親切口語、年輕活潑、不過度推銷」）
  "taboo_words": string[]              // 0-10 個應避免使用的詞（依品牌調性推測）；不確定時回 []
}

## 規則
1. **只輸出 JSON 物件本身**，不要 \`\`\`json 包覆、不要任何前言後語
2. 內容用繁體中文（除非品牌本身是英文品牌）
3. 不確定的欄位用合理推測，但要 flag 出來「依據網站推測，建議再人工確認」
4. positioning / target_audience 不可空字串，至少給 30 字推測`;

  const userMessage = `## 來源網址
${page.url}

## 網站標題
${page.title}

## 網站描述
${page.description}

## 網站可見內容（前 ${page.text.length} 字${page.truncated ? "，已截斷" : ""}）
${page.text}

請輸出 JSON。`;

  const client = await anthropic();
  const stream = client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  let raw = "";
  for await (const event of stream) {
    if (event.type !== "content_block_delta") continue;
    if (event.delta?.type !== "text_delta") continue;
    if (event.delta.text) raw += event.delta.text;
  }

  let parsed: unknown;
  try {
    parsed = safeJsonExtract(raw);
  } catch {
    throw new Error("ai_returned_invalid_json");
  }

  const obj = parsed as Partial<BrandIdentityAnalysis>;
  return {
    brand_name: typeof obj.brand_name === "string" ? obj.brand_name : null,
    positioning: typeof obj.positioning === "string" ? obj.positioning : "",
    target_audience: typeof obj.target_audience === "string" ? obj.target_audience : "",
    tone_guide: typeof obj.tone_guide === "string" ? obj.tone_guide : "",
    taboo_words: Array.isArray(obj.taboo_words)
      ? obj.taboo_words.filter((w) => typeof w === "string").slice(0, 10)
      : [],
    fetchedText: page.text,
    pageTitle: page.title,
  };
}

export async function analyzeCompetitorFromUrl(
  url: string,
  brandName: string,
  brandPositioning: string | null,
  brandTargetAudience: string | null
): Promise<CompetitorAnalysis & { fetchedText: string; pageTitle: string }> {
  const page = await fetchPage(url);
  if (!page.text || page.text.length < 50) {
    throw new Error("page_too_short — 抓不到足夠內容");
  }

  const systemPrompt = `你是 Loamia 的競品分析師。先判斷對方是否真的是我們的競品，再決定是否進行分析。

## 我們的品牌
- 名稱：${brandName}
${brandPositioning ? `- 定位：${brandPositioning}\n` : ""}${brandTargetAudience ? `- 目標受眾：${brandTargetAudience}\n` : ""}

## 競品判斷標準（嚴格！）
真正的競品須**滿足至少兩項**：
1. 同產業 / 同類別產品或服務
2. 目標受眾明顯重疊（不是「同樣是人」這種泛化）
3. 在使用者心中是替代選項（消費者真的會在這兩個品牌間做選擇）

**反例（必須拒絕）**：
- 我是手搖飲品牌、對方是科技公司 → 不相關
- 我是 SaaS、對方是餐廳 → 不相關
- 雙方雖在同國家但行業差太遠 → 不相關
- 對方是供應商或合作對象、不是替代品 → 不相關

## 輸出（嚴格 JSON，所有欄位必填）
{
  "relevance_score": number,        // 1-10，1=完全不相關，10=直接競爭
  "relevance_reason": string,       // 50-150 字，說明判斷依據（產業、受眾、替代性）
  "is_competitor": boolean,         // relevance_score >= 5 才為 true
  "title": string,                  // is_competitor=true 時：30-60 字摘要；false 時填「不相關 — [簡短理由]」
  "content": string                 // is_competitor=true 時：200-400 字策略摘要 + 差異化建議；false 時填「無關於本品牌的可行分析」
}

## 規則
1. **只輸出 JSON 物件**，不要 \`\`\`json 包覆、不要前言後語
2. 用繁體中文
3. 寧可保守拒絕也不要硬找關聯——使用者最不滿的就是「明明不相關 AI 還硬分析」
4. content（當 is_competitor=true 時）結尾必須一句「差異化建議」或「我們可切入的機會」`;

  const userMessage = `## 競品網址
${page.url}

## 標題
${page.title}

## 描述
${page.description}

## 網站內容（前 ${page.text.length} 字${page.truncated ? "，已截斷" : ""}）
${page.text}

請輸出 JSON。`;

  const client = await anthropic();
  const stream = client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  let raw = "";
  for await (const event of stream) {
    if (event.type !== "content_block_delta") continue;
    if (event.delta?.type !== "text_delta") continue;
    if (event.delta.text) raw += event.delta.text;
  }

  let parsed: unknown;
  try {
    parsed = safeJsonExtract(raw);
  } catch {
    throw new Error("ai_returned_invalid_json");
  }
  const obj = parsed as Partial<CompetitorAnalysis>;
  return {
    relevance_score: typeof obj.relevance_score === "number" ? obj.relevance_score : 5,
    relevance_reason: typeof obj.relevance_reason === "string" ? obj.relevance_reason : "",
    is_competitor: typeof obj.is_competitor === "boolean" ? obj.is_competitor : true,
    title: typeof obj.title === "string" ? obj.title : "競品分析",
    content: typeof obj.content === "string" ? obj.content : "",
    fetchedText: page.text,
    pageTitle: page.title,
  };
}
