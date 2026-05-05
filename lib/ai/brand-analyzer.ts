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
): Promise<BrandIdentityAnalysis> {
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
  };
}

export async function analyzeCompetitorFromUrl(
  url: string,
  brandName: string,
  brandPositioning: string | null
): Promise<CompetitorAnalysis> {
  const page = await fetchPage(url);
  if (!page.text || page.text.length < 50) {
    throw new Error("page_too_short — 抓不到足夠內容");
  }

  const systemPrompt = `你是 Loamia 的競品分析師。根據提供的競品內容，輸出**嚴格的 JSON**，總結該競品對「${brandName}」的競爭意義。

## 我們的品牌
${brandName}${brandPositioning ? `\n定位：${brandPositioning}` : ""}

## 輸出 JSON schema
{
  "title": string,    // 30-60 字標題，點出競品最關鍵特徵（例：「競品X主打速度與低價，目標小資族」）
  "content": string   // 200-400 字摘要，涵蓋：(1) 競品定位 / 主打訴求 (2) 內容語氣 (3) 近期動作或話題 (4) 對「${brandName}」的差異化機會
}

## 規則
1. **只輸出 JSON 物件**，不要 \`\`\`json 包覆、不要前言後語
2. 用繁體中文
3. 重點是「對我們有什麼意義」，不只是描述競品本身
4. content 結尾必須有一句「差異化建議」或「我們可切入的機會」`;

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
    max_tokens: 1200,
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
    title: typeof obj.title === "string" ? obj.title : "競品分析",
    content: typeof obj.content === "string" ? obj.content : "",
  };
}
