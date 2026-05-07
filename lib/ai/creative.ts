import "server-only";
import { anthropic, CHAT_MODEL } from "./anthropic";
import { retrieveRelevantChunks } from "./report";
import { createClient } from "@/lib/supabase/server";
import { assembleBrandBrainContext, formatBrandBrainPrompt } from "./brand-brain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeWebSearch, executeWebFetch } from "./tools";

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
    .map((v) => cleanGeneratedPost(v))
    .filter((v) => v.length > 10);

  return {
    variants: variants.length > 0 ? variants : [cleanGeneratedPost(raw)],
    sources: chunks.map((c) => c.filename).filter(Boolean),
  };
}

/**
 * Agentic Threads-post generator with web tools.
 * Used by scheduler when template.enable_web_tools = true.
 * Privacy + cost guards:
 *  - Same blacklist filter as chat (reuses executeWebSearch)
 *  - Hard cap: max 5 tool turns
 *  - Returns single post text (≤500 chars)
 */
/**
 * Defensive cleaner — strips AI meta commentary that leaked past the prompt.
 * Catches both <post>...</post> wrappers and free-form preambles.
 *
 * Why: agentic Anthropic responses sometimes prepend status sentences
 * ("搜尋結果有限，我將..."), which look like bot output to readers and
 * to platform anti-spam. This is the LAST line of defense before publishing.
 */
function cleanGeneratedPost(raw: string): string {
  let text = raw.trim();

  // 1) Prefer <post>...</post> envelope if present
  const tagMatch = text.match(/<post[^>]*>([\s\S]*?)<\/post>/i);
  if (tagMatch) {
    text = tagMatch[1].trim();
  }

  // 2) Strip any remaining stray opening/closing tag fragments
  text = text.replace(/<\/?post[^>]*>/gi, "").trim();

  // 3) If a "---" separator appears within first 250 chars, take what's AFTER
  const sepIdx = text.indexOf("---");
  if (sepIdx >= 0 && sepIdx < 250) {
    const after = text.slice(sepIdx + 3).trim();
    if (after.length > 30) text = after;
  }

  // 4) Drop leading lines that match known meta patterns
  const metaPatterns = [
    /^(好的|沒問題|了解|收到|感謝)/,
    /^(以下是|這是)/,
    /^(我[將會來想要]|讓我)/,
    /^(根據|依據|基於|參考).*?(資料|內容|品牌|prompt|Identity|Brain|搜尋)/,
    /^(搜尋|查詢|找到|資料|內容).*?(結果|有限|不足|無法)/,
    /Brand\s*(Identity|Brain)/i,
    /^.{0,50}(生成|撰寫|寫).{0,30}(貼文|內容|這則)/,
    /^---+$/,
  ];
  const lines = text.split(/\r?\n/);
  let drop = 0;
  while (drop < lines.length) {
    const ln = lines[drop].trim();
    if (!ln) {
      drop += 1;
      continue;
    }
    const looksMeta = metaPatterns.some((re) => re.test(ln));
    if (!looksMeta) break;
    drop += 1;
  }
  if (drop > 0) text = lines.slice(drop).join("\n").trim();

  // 5) Strip trailing meta lines too (e.g. AI explaining what it did at the end)
  const trailing: RegExp[] = [
    /^希望.{0,20}(這|這則|這篇)/,
    /^以上.{0,20}(是|為)/,
    /^(備註|附註|說明)[:：]/,
  ];
  const lines2 = text.split(/\r?\n/);
  let cut = lines2.length;
  for (let i = lines2.length - 1; i >= 0; i--) {
    const ln = lines2[i].trim();
    if (!ln) {
      cut = i;
      continue;
    }
    if (trailing.some((re) => re.test(ln))) cut = i;
    else break;
  }
  text = lines2.slice(0, cut).join("\n").trim();

  return text.slice(0, 500);
}

export type GenEvent =
  | { stage: "context" }
  | { stage: "thinking"; turn: number }
  | { stage: "tool_call"; tool: string; input: Record<string, unknown> }
  | { stage: "tool_result"; tool: string; ok: boolean; summary: string }
  | { stage: "writing" }
  | { stage: "done"; text: string };

export async function generateThreadsPostWithWebTools(
  supabase: SupabaseClient,
  brand: { id: string; agency_id: string; name: string },
  userId: string,
  prompt: string,
  onEvent?: (e: GenEvent) => void
): Promise<{ text: string; toolCalls: number; sources: string[] }> {
  onEvent?.({ stage: "context" });
  // Brand context (same as non-agentic path)
  const chunks = await retrieveRelevantChunks(brand.id, prompt, "zh", 8);
  const contextBlock =
    chunks.length === 0
      ? "（沒有找到相關歷史資料）"
      : chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");

  const brainCtx = await assembleBrandBrainContext(supabase, brand.id, "caption");
  const brainBlock = brainCtx ? formatBrandBrainPrompt(brainCtx) : "";

  const systemPrompt = `你是 Loamia 的 AI 排程貼文生成助理，為「${brand.name}」產出符合品牌調性的單則 Threads 貼文。

## 內容類型
${CONTENT_TYPE_HINTS.threads_post.zh}

## 使用者 prompt（模板原始指令）
${prompt.trim()}

${brainBlock ? `# Brand Brain\n${brainBlock}\n` : ""}
## 品牌歷史資料
${contextBlock}

## 你可以使用的工具
- web_search：搜尋公開網路（DuckDuckGo），用來找今日新聞、產業趨勢、節慶話題、公開素材
- web_fetch：抓取特定 URL 的內容

## 🚨 隱私強制規則（違反就是失職）
1. web_search 的 query 只能是「一般公開知識性問題」，例如「台灣 5 月 7 日 節日」「手搖飲市場 2026 趨勢」
2. **絕對不可在 query 內**包含品牌私有資訊：使用者私存的品牌名（除非廣為人知）、客戶聯絡資料、合作費率、KOL 名單、未公開檔期、Brand Identity 細節、Winning Memory
3. query 想拿時事題材時：搜尋「該產業／類別／節氣／日期」，不要把品牌名、客戶名塞進去
4. 至多呼叫 5 次工具，超過要立刻收斂出最終貼文
5. 數字事實要有公開來源

## ⚠️ 輸出格式（這是給 Threads 上真正讀者看的，不是給我）
**最終貼文必須用 \`<post>\` 與 \`</post>\` 標籤包起來。**
標籤之外可以放你的思考過程，但**標籤之內絕對不能出現以下內容**：
- 任何狀態說明（「搜尋結果有限」「我將以...為基礎」「資料中沒有」「以下是」「好的」「讓我」）
- 任何提到 AI、Brand Identity、Brand Brain、模板、prompt、品牌資料的詞
- 任何「我會 / 我將 / 我來 / 我幫你」的自述
- 任何分隔線（---）、章節標題（## 之類）、給我的提示
- 任何「根據資料」「依據品牌」這類 meta 字句

標籤之內**只放可以直接貼到 Threads 給粉絲讀的最終文字**，繁體中文，500 字內。

範例：
\`<post>
今天有發現一個小細節想跟大家分享...
... 你呢？
</post>\`

## 規則
1. 用繁體中文
2. 只輸出 1 則貼文（不要多個變體）
3. 風格要呼應品牌調性，遵守 Brand Identity 禁忌詞
4. 數字／事實只能來自上方資料 + 你搜到的公開內容；資料中沒的避免具體數字
5. 想不到要寫什麼也不要解釋，就照模板 prompt 的精神硬寫一則正常貼文`;

  const tools = [
    {
      name: "web_search",
      description:
        "Search the public web (DuckDuckGo). Query MUST be generic public knowledge — never include private brand data.",
      input_schema: {
        type: "object" as const,
        properties: { query: { type: "string", description: "Generic public-knowledge query, ≤100 chars" } },
        required: ["query"],
      },
    },
    {
      name: "web_fetch",
      description: "Fetch a specific URL and return its visible text.",
      input_schema: {
        type: "object" as const,
        properties: { url: { type: "string", description: "The URL to fetch (http/https)" } },
        required: ["url"],
      },
    },
  ];

  const client = await anthropic();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: "user", content: "請依模板 prompt 生成這次的 Threads 貼文。" }];
  let toolCalls = 0;
  const sources: string[] = [...chunks.map((c) => c.filename).filter(Boolean)];
  const MAX_TURNS = 6;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    onEvent?.({ stage: "thinking", turn: turn + 1 });
    const resp = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      tools,
      messages,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = resp.content as any[];
    messages.push({ role: "assistant", content: blocks });

    if (resp.stop_reason !== "tool_use") {
      onEvent?.({ stage: "writing" });
      const raw = blocks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b.type === "text")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => String(b.text ?? ""))
        .join("\n");
      const text = cleanGeneratedPost(raw);
      onEvent?.({ stage: "done", text });
      return { text, toolCalls, sources };
    }

    // Handle tool calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUses = blocks.filter((b: any) => b.type === "tool_use");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolResults: any[] = [];
    for (const tu of toolUses) {
      toolCalls += 1;
      onEvent?.({
        stage: "tool_call",
        tool: tu.name,
        input: (tu.input ?? {}) as Record<string, unknown>,
      });
      let result: unknown;
      let summary = "";
      if (tu.name === "web_search") {
        result = await executeWebSearch(supabase, brand, userId, tu.input ?? {});
        if (
          typeof result === "object" &&
          result !== null &&
          "ok" in result &&
          (result as { ok: boolean }).ok &&
          "results" in result
        ) {
          const arr = (result as { results: { url: string; title: string }[] }).results;
          for (const r of arr) {
            if (r.url) sources.push(r.url);
          }
          summary = `找到 ${arr.length} 筆結果`;
        } else if (
          typeof result === "object" &&
          result !== null &&
          "error" in result
        ) {
          summary = String((result as { error: string }).error).slice(0, 100);
        }
      } else if (tu.name === "web_fetch") {
        result = await executeWebFetch(tu.input ?? {});
        if (
          typeof result === "object" &&
          result !== null &&
          "ok" in result &&
          (result as { ok: boolean }).ok &&
          "url" in result
        ) {
          const r = result as { url: string; title?: string };
          sources.push(r.url);
          summary = String(r.title ?? r.url).slice(0, 80);
        } else if (
          typeof result === "object" &&
          result !== null &&
          "error" in result
        ) {
          summary = String((result as { error: string }).error).slice(0, 100);
        }
      } else {
        result = { ok: false, error: `unknown tool: ${tu.name}` };
        summary = `unknown tool: ${tu.name}`;
      }
      const ok =
        typeof result === "object" &&
        result !== null &&
        "ok" in result &&
        (result as { ok: boolean }).ok === true;
      onEvent?.({ stage: "tool_result", tool: tu.name, ok, summary });
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result).slice(0, 4000),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Hit max turns — force a final answer
  onEvent?.({ stage: "writing" });
  const final = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 800,
    system: systemPrompt + "\n\n達到工具呼叫上限，請依目前資訊立刻輸出最終貼文。",
    messages,
  });
  const finalRaw = (final.content as unknown[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any) => b.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b: any) => String(b.text ?? ""))
    .join("\n");
  const finalText = cleanGeneratedPost(finalRaw);
  onEvent?.({ stage: "done", text: finalText });
  return { text: finalText, toolCalls, sources };
}

/**
 * Generate a single contextual reply for OUTREACH on someone else's public Threads post.
 * Tone: like a normal user joining the conversation, NOT a salesperson.
 * Brand mention: optional, soft, only if natural.
 */
export async function generateOutreachReply(
  brandId: string,
  brandName: string,
  targetText: string,
  targetUsername: string | null,
  keyword: string
): Promise<{ reply: string }> {
  const chunks = await retrieveRelevantChunks(brandId, `${keyword} ${targetText}`, "zh", 6);
  const contextBlock =
    chunks.length === 0
      ? "（無相關歷史片段）"
      : chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");

  const supabase = await createClient();
  const brainCtx = await assembleBrandBrainContext(supabase, brandId, "reply");
  const brainBlock = brainCtx ? formatBrandBrainPrompt(brainCtx) : "";

  const systemPrompt = `你是「${brandName}」品牌的社群參與助手。以下是 Threads 上一則公開貼文（不是給你的回覆，是別人發的話題），你要寫一則「自然加入討論」的留言。

## 目標貼文
${targetUsername ? `@${targetUsername}：` : ""}「${targetText.slice(0, 600)}」

## 搜尋情境
這篇貼文是用關鍵字「${keyword}」搜到的。

${brainBlock ? `# Brand Brain\n${brainBlock}\n` : ""}
## 品牌歷史片段參考
${contextBlock}

## 規則（違反就是 spam）
1. **像一個真人網友**在路過參與討論，不是品牌客服
2. 留言**不超過 80 字**（Threads 上太長會被忽略）
3. 用繁體中文，口語自然，可以加 1-2 個 emoji
4. **不要**貼網址、不要 hashtag 行銷、不要喊口號、不要叫對方私訊或 DM
5. 品牌名「${brandName}」**最多提到一次**，而且必須是自然的「我自己也常喝/用 X」這種口吻；如果硬塞會很怪就不要提
6. 如果貼文是抱怨／求助：先共感再分享經驗；不要直接推銷
7. 如果貼文是分享心情／日常：留共鳴的留言即可，不必硬扯品牌
8. **絕對禁止**：「歡迎來/快來/找我們」、「我們的產品」、「私訊我」、價格資訊、「歡迎詢問」
9. 用 \`<reply>...</reply>\` 把最終留言包起來，標籤外可以放思考過程

只輸出 1 則留言，不要多版本。`;

  const client = await anthropic();
  const response = await client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 800,
    system: systemPrompt,
    messages: [{ role: "user", content: "請寫這則留言。" }],
  });

  let raw = "";
  for await (const event of response) {
    if (event.type !== "content_block_delta") continue;
    if (event.delta?.type !== "text_delta") continue;
    if (event.delta.text) raw += event.delta.text;
  }

  // Extract from <reply>...</reply> if present, else use cleanGeneratedPost
  const tagMatch = raw.match(/<reply[^>]*>([\s\S]*?)<\/reply>/i);
  const inner = tagMatch ? tagMatch[1] : raw;
  const reply = cleanGeneratedPost(inner).slice(0, 200);

  return { reply };
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
