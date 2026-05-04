import "server-only";
import { createClient } from "@/lib/supabase/server";
import { anthropic, CHAT_MODEL } from "./anthropic";
import { embed } from "./embeddings";
import { getStyleHint, type StyleKey } from "./styles";

export type ReportCitation = {
  id: string;
  document_id: string;
  filename: string;
};

export type RetrievedChunk = {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  similarity: number;
};

export type Tone = "professional" | "business" | "client" | "internal" | "casual" | "data";
export type Length = "short" | "standard" | "detailed";
export type Lang = "zh" | "en";

export type ReportOptions = {
  focus: string;
  sections: string[];
  tone: Tone;
  length: Length;
  lang: Lang;
  style?: StyleKey;
};

const RELEVANCE_THRESHOLD = 0.3;
const TOP_K_DEFAULT_FOCUS = 50;
const FALLBACK_QUERY_ZH = "本期結案報告 月度成效 KPI 重點活動";
const FALLBACK_QUERY_EN = "monthly closure report performance KPI key activities";

export const DEFAULT_SECTIONS: Record<"zh" | "en", string[]> = {
  zh: ["執行摘要", "本期活動", "關鍵成效", "觀察與洞察", "下期建議"],
  en: ["Executive Summary", "Activities", "Key Performance", "Observations", "Recommendations"],
};

export const SECTION_TEMPLATES: Record<string, Record<Lang, string[]>> = {
  standard: {
    zh: ["執行摘要", "本期活動", "關鍵成效", "觀察與洞察", "下期建議"],
    en: ["Executive Summary", "Activities", "Key Performance", "Observations", "Recommendations"],
  },
  campaign: {
    zh: ["檔期摘要", "活動策略", "KPI 達成", "亮點分析", "學習與優化"],
    en: ["Campaign Summary", "Strategy", "KPI Achievement", "Highlights", "Lessons Learned"],
  },
  kol: {
    zh: ["合作 KOL 名單", "各 KOL 表現", "ROI 分析", "後續合作建議"],
    en: ["KOL Roster", "Individual Performance", "ROI Analysis", "Future Recommendations"],
  },
  brief: {
    zh: ["重點摘要", "關鍵數據", "建議事項"],
    en: ["Summary", "Key Metrics", "Recommendations"],
  },
};

const TONE_INSTRUCTIONS: Record<Tone, { zh: string; en: string }> = {
  professional: {
    zh: "語氣專業正式、嚴謹精準，使用業界術語，避免口語化",
    en: "Professional and formal, precise, industry vocabulary, avoid casual language",
  },
  business: {
    zh: "商業簡潔，重點明確、邏輯清晰，類似 McKinsey-style 顧問報告",
    en: "Business concise, clear bullet points, McKinsey-style consulting report",
  },
  client: {
    zh: "面向客戶溝通：解釋技術名詞、強調對品牌的價值與成果，避免代理商內部術語",
    en: "Client-facing: explain jargon, emphasize brand value and outcomes, avoid agency-internal terms",
  },
  internal: {
    zh: "內部 review 用：直接點出問題、可寫團隊執行細節、適度用代理商內部術語",
    en: "Internal review: direct about issues, include team execution details, agency lingo OK",
  },
  casual: {
    zh: "親切口語、像跟同事在報告，文字溫度較高但仍維持專業；不使用 emoji",
    en: "Conversational, like reporting to a colleague, warmer tone but still professional; no emoji",
  },
  data: {
    zh: "數據導向：每個論點都引用具體數字，多用表格、項目符號清單呈現",
    en: "Data-driven: every claim with concrete numbers, use tables and bullet lists",
  },
};

const LENGTH_HINT: Record<Length, { zh: string; en: string }> = {
  short: { zh: "整體 400-600 字，每段 2-4 句", en: "Total 400-600 words, 2-4 sentences per section" },
  standard: { zh: "整體 1000-1500 字", en: "Total 1000-1500 words" },
  detailed: { zh: "整體 2200-2800 字，可加細節案例", en: "Total 2200-2800 words, may include detailed examples" },
};

export async function retrieveRelevantChunks(
  brandId: string,
  focus: string,
  lang: Lang = "zh",
  k = TOP_K_DEFAULT_FOCUS
): Promise<RetrievedChunk[]> {
  const fallback = lang === "en" ? FALLBACK_QUERY_EN : FALLBACK_QUERY_ZH;
  const query = focus.trim() || fallback;
  const [queryEmbedding] = await embed([query]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    target_brand_id: brandId,
    match_count: k,
  });
  if (error) throw new Error(`retrieve: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}

export async function fetchChunksByDocs(
  brandId: string,
  documentIds: string[]
): Promise<RetrievedChunk[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_chunks")
    .select("id, document_id, content, documents(filename)")
    .eq("brand_id", brandId)
    .in("document_id", documentIds)
    .order("chunk_index", { ascending: true })
    .limit(200);
  if (error) throw new Error(`fetch chunks by docs: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    document_id: c.document_id as string,
    filename: ((c.documents as unknown as { filename: string })?.filename) ?? "",
    content: c.content as string,
    similarity: 1,
  }));
}

export function isRelevant(chunks: RetrievedChunk[]): boolean {
  if (chunks.length === 0) return false;
  return chunks[0].similarity >= RELEVANCE_THRESHOLD;
}

export async function listBrandDocuments(brandId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, filename, status, byte_size, created_at")
    .eq("brand_id", brandId)
    .eq("status", "ready")
    .order("created_at", { ascending: false });
  return data ?? [];
}

function buildPrompt(brandName: string, chunks: RetrievedChunk[], opts: ReportOptions): string {
  const { focus, sections, tone, length, lang, style } = opts;
  const sectionList = sections.length > 0 ? sections : DEFAULT_SECTIONS[lang];
  const sectionInstructions = sectionList.map((s, i) => `${i + 1}. **${s}**`).join("\n");

  const contextBlock = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n---\n\n");
  const focusLine = focus.trim() ? `\n\n【使用者主題重點】${focus.trim()}\n` : "";
  const styleHint = getStyleHint(style, lang);

  if (lang === "en") {
    return `You are Loamia's report-generation assistant. Based on the brand data below, produce a structured closure report for "${brandName}".

## Structure (use Markdown)
# ${brandName} — Closure Report

${sectionList.map((s) => `## ${s}\n(write content for this section)`).join("\n\n")}

## Style
${TONE_INSTRUCTIONS[tone].en}${styleHint ? `\n${styleHint}` : ""}

## Length
${LENGTH_HINT[length].en}

## Rules
1. Numbers and facts must come from the data below — never fabricate
2. Cite using [n] format (e.g. "Engagement reached 5.7% [3]")
3. If a section has no relevant data, write "**No relevant data this period**" — do not invent
4. Generalize and analyze — do not just paraphrase the source${focusLine}

## Brand Data
${contextBlock}`;
  }

  return `你是 Loamia 的結案報表生成助理。基於提供的品牌資料，為「${brandName}」產出一份結構化的結案報告。

## 結構（使用 Markdown 標題）
# ${brandName} 結案報告

${sectionList.map((s) => `## ${s}\n（這段請寫對應內容）`).join("\n\n")}

依序對應上方段落，每段一個 H2。

## 寫作風格
${TONE_INSTRUCTIONS[tone].zh}${styleHint ? `\n${styleHint}` : ""}

## 長度
${LENGTH_HINT[length].zh}

## 段落清單（依此順序產出）
${sectionInstructions}

## 規則
1. **數字與事實只能來自下方提供的資料**，不要編造任何數字
2. 引用具體資料時用 [n] 格式（例如「IG 互動率達 5.7% [3]」）
3. 如果某個區塊在資料中找不到內容，誠實寫「**本期資料中暫無相關資訊**」，不要硬編
4. 不要重複資料原文，要做歸納與分析${focusLine}

## 品牌資料
${contextBlock}`;
}

export async function generateReportFromChunks(
  brandName: string,
  chunks: RetrievedChunk[],
  opts: ReportOptions
): Promise<{ content: string; citations: ReportCitation[] }> {
  const citations: ReportCitation[] = chunks.map((c) => ({
    id: c.id,
    document_id: c.document_id,
    filename: c.filename,
  }));

  const systemPrompt = buildPrompt(brandName, chunks, opts);

  const userMessage =
    opts.lang === "en"
      ? opts.focus.trim()
        ? `Generate the closure report focused on "${opts.focus.trim()}".`
        : `Generate this period's closure report.`
      : opts.focus.trim()
        ? `請依重點「${opts.focus.trim()}」生成結案報告。`
        : "請生成本期結案報告。";

  const client = await anthropic();
  const maxTokens = opts.length === "detailed" ? 6000 : opts.length === "short" ? 1800 : 4096;
  const response = await client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  let content = "";
  for await (const event of response) {
    if (event.type !== "content_block_delta") continue;
    if (event.delta?.type !== "text_delta") continue;
    const text = event.delta.text;
    if (text) content += text;
  }

  return { content, citations };
}

export function makeAutoTitle(brandName: string, focus: string, lang: Lang): string {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const suffix = lang === "en" ? "Report" : "結案報告";
  if (focus.trim()) return `${brandName} · ${focus.trim().slice(0, 30)}（${ym}）`;
  return `${brandName} · ${ym} ${suffix}`;
}
