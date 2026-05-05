import "server-only";
import { anthropic, CHAT_MODEL } from "./anthropic";
import { retrieveRelevantChunks } from "./report";
import { createClient } from "@/lib/supabase/server";
import { assembleBrandBrainContext, formatBrandBrainPrompt } from "./brand-brain";

export type ContentType =
  | "ig_post"
  | "fb_ad"
  | "threads_post"
  | "kol_brief"
  | "campaign_plan"
  | "email"
  | "custom";

export const CONTENT_TYPE_HINTS: Record<ContentType, { zh: string; en: string }> = {
  ig_post: {
    zh: "Instagram 貼文：吸睛開頭、3-4 段、適度 emoji、結尾加 CTA、5-10 個 hashtag",
    en: "Instagram post: hook opening, 3-4 paragraphs, modest emoji, CTA, 5-10 hashtags",
  },
  fb_ad: {
    zh: "Facebook 廣告文案：大標題 + 副標 + 內文 + 行動呼籲。長度約 80-150 字",
    en: "Facebook ad copy: headline + subheadline + body + CTA, ~80-150 characters",
  },
  threads_post: {
    zh: "Threads 貼文：500 字內、語氣口語自然、可以引發討論",
    en: "Threads post: under 500 chars, conversational, sparks discussion",
  },
  kol_brief: {
    zh: "KOL 合作 Brief：含合作目標、品牌重點、創作建議、規範與注意事項",
    en: "KOL Brief: collaboration goals, brand points, content suggestions, guidelines",
  },
  campaign_plan: {
    zh: "活動企劃：含活動名稱、目標 KPI、檔期、機制、宣傳節奏、預算配比",
    en: "Campaign plan: name, KPI, schedule, mechanic, promotion cadence, budget split",
  },
  email: {
    zh: "EDM/email 文案：主旨、開頭、本文（含產品重點 + 利益點）、CTA、結尾",
    en: "Email copy: subject, intro, body (product points + benefits), CTA, closing",
  },
  custom: {
    zh: "依使用者需求自訂內容類型",
    en: "Custom content type per user request",
  },
};

const VARIANT_SEPARATOR = "===VARIANT===";

export async function generateContentVariants(
  brandId: string,
  brandName: string,
  type: ContentType,
  prompt: string,
  audience: string
): Promise<{ variants: string[]; sources: string[] }> {
  // Retrieve brand context
  const query = `${prompt} ${audience} ${type}`.trim();
  const chunks = await retrieveRelevantChunks(brandId, query, "zh", 12);
  const contextBlock =
    chunks.length === 0
      ? "（沒有找到相關歷史資料；憑借品牌名稱與使用者要求生成，避免具體數字捏造）"
      : chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");

  // Brand Brain — three-layer memory
  const supabase = await createClient();
  const brainCtx = await assembleBrandBrainContext(supabase, brandId, "caption");
  const brainBlock = brainCtx ? formatBrandBrainPrompt(brainCtx) : "";

  const typeHint = CONTENT_TYPE_HINTS[type].zh;
  const audienceLine = audience.trim() ? `\n\n## 目標受眾\n${audience.trim()}` : "";

  const systemPrompt = `你是 Loamia 的 AI 文案生成助理，為「${brandName}」產出符合品牌調性的內容。

## 內容類型
${typeHint}

## 使用者需求
${prompt.trim()}${audienceLine}

${brainBlock ? `# Brand Brain\n${brainBlock}\n` : ""}
## 品牌風格參考（從歷史資料推測，不一定要直接引用）
${contextBlock}

## 規則
1. 用繁體中文
2. 產出**3 個獨立變體**，每個都可直接使用
3. **每個變體之間用 \`${VARIANT_SEPARATOR}\` 分隔**（單獨一行）
4. 變體之間應該有差異（角度、長度、語氣不同）
5. 風格要呼應品牌歷史調性 + 遵守 Brand Identity 的禁忌詞
6. 數字 / 事實只能來自上方資料；資料中沒有的避免具體數字
7. 不要編號、不要前言「以下是三個版本」這類，直接給文案內容`;

  const client = await anthropic();
  const response = await client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 3500,
    system: systemPrompt,
    messages: [{ role: "user", content: "請生成。" }],
  });

  let raw = "";
  for await (const event of response) {
    if (event.type !== "content_block_delta") continue;
    if (event.delta?.type !== "text_delta") continue;
    if (event.delta.text) raw += event.delta.text;
  }

  const variants = raw
    .split(VARIANT_SEPARATOR)
    .map((v) => v.trim())
    .filter((v) => v.length > 10);

  return {
    variants: variants.length > 0 ? variants : [raw.trim()],
    sources: chunks.map((c) => c.filename).filter(Boolean),
  };
}

const REPLY_SEPARATOR = "===REPLY===";

export async function generateMonitorReplies(
  brandId: string,
  brandName: string,
  sourceText: string,
  sourceType: string,
  tone: string
): Promise<{ suggestions: string[] }> {
  // Retrieve brand context — focus on past replies, brand voice
  const query = `品牌風格 回覆 客服 語氣 ${sourceText.slice(0, 200)}`;
  const chunks = await retrieveRelevantChunks(brandId, query, "zh", 8);
  const contextBlock =
    chunks.length === 0
      ? "（沒有歷史風格參考；以一般品牌客服語氣處理）"
      : chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");

  // Brand Brain — three-layer memory
  const supabase = await createClient();
  const brainCtx = await assembleBrandBrainContext(supabase, brandId, "reply");
  const brainBlock = brainCtx ? formatBrandBrainPrompt(brainCtx) : "";

  const toneLine = tone.trim() ? `\n## 期望語氣\n${tone.trim()}` : "";
  const sourceLine = sourceType.trim() ? `（來源：${sourceType}）` : "";

  const systemPrompt = `你是 Loamia 的 AI Engagement Engine，協助「${brandName}」產出符合品牌風格的回覆建議。

## 待回覆內容${sourceLine}
${sourceText.trim()}
${toneLine}

${brainBlock ? `# Brand Brain\n${brainBlock}\n` : ""}
## 品牌歷史片段參考
${contextBlock}

## 規則
1. 用繁體中文
2. 產出**剛好 3 個版本**（v6 計畫書 Engagement Engine 三種版本），**用 \`${REPLY_SEPARATOR}\` 分隔**（單獨一行）：
   - 版本 1【自然分享版】：像朋友隨意回應，自然親切，不推銷
   - 版本 2【專業解答版】：以品牌專業角度解答疑慮或提供實質資訊
   - 版本 3【輕推 CTA 版】：自然帶到品牌服務／產品，但不強迫，留給對方主動權
3. 直接給**可發布的文字**，不要前言「以下是建議：」這類；不要在回覆內標註「自然分享版」這類字
4. 必須遵守 Brand Identity 的禁忌詞與調性
5. 若 Winning Memory 中有類似情境的成功範例，**參考其結構與語氣**（不是直接複製）
6. 不可承諾品牌做不到的事；不可洩漏內部資訊`;

  const client = await anthropic();
  const response = await client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: "請產出 3 個回覆建議。" }],
  });

  let raw = "";
  for await (const event of response) {
    if (event.type !== "content_block_delta") continue;
    if (event.delta?.type !== "text_delta") continue;
    if (event.delta.text) raw += event.delta.text;
  }

  const suggestions = raw
    .split(REPLY_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return { suggestions: suggestions.length > 0 ? suggestions : [raw.trim()] };
}
