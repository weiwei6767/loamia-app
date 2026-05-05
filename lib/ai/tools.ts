import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  retrieveRelevantChunks,
  isRelevant,
  generateReportFromChunks,
  makeAutoTitle,
  type Tone,
  type Length,
  type Lang,
  type ReportOptions,
} from "./report";
import {
  generateContentVariants,
  generateMonitorReplies,
  type ContentType,
} from "./creative";

export const CHAT_TOOLS = [
  {
    name: "generate_report",
    description:
      "Generate a closure report for the brand based on the brand's uploaded data (RAG). Only use when the user explicitly asks to generate/create/produce a report (e.g., '生成報表', '做月報', '幫我寫結案報告'). Ask the user for the focus topic via conversation BEFORE calling this tool if it isn't clear. Do NOT call this for simple questions or data lookups.",
    input_schema: {
      type: "object" as const,
      properties: {
        focus: {
          type: "string",
          description:
            "Main focus or topic of the report — e.g., '6月活動成效', 'KOL合作分析', '雙11檔期'. Must be specified by the user.",
        },
        tone: {
          type: "string",
          enum: ["professional", "business", "client", "internal", "casual", "data"],
          description: "Writing tone. Default 'professional' if unsure.",
        },
        length: {
          type: "string",
          enum: ["short", "standard", "detailed"],
          description: "'short' (~500 words), 'standard' (~1200), 'detailed' (~2500). Default 'standard'.",
        },
        lang: {
          type: "string",
          enum: ["zh", "en"],
          description: "Output language. Default 'zh'.",
        },
      },
      required: ["focus"],
    },
  },
  {
    name: "generate_content",
    description:
      "Generate AI marketing copy / social content for the brand. Use when the user asks to write a post / caption / ad / EDM / brief (e.g., '寫一則 IG 貼文', '幫我寫 Threads 文案', '做 Facebook 廣告文案', '寫一封 EDM'). Output is 3 variants. Pick `type` from the user's request — default to 'ig_post' for general '貼文'.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["ig_post", "fb_ad", "threads_post", "kol_brief", "campaign_plan", "email", "custom"],
          description:
            "Content type: 'ig_post'=IG, 'threads_post'=Threads, 'fb_ad'=FB ad, 'kol_brief'=KOL合作brief, 'campaign_plan'=活動企劃, 'email'=EDM/email.",
        },
        prompt: {
          type: "string",
          description: "Detailed user request — what to write about, key message, any constraints.",
        },
        audience: {
          type: "string",
          description: "Target audience description, e.g., '25-35歲女性上班族'. Optional.",
        },
      },
      required: ["type", "prompt"],
    },
  },
  {
    name: "generate_reply_suggestions",
    description:
      "Generate 3 AI reply suggestions for a social comment / post the user pastes (Engagement Engine: 自然分享版 / 專業解答版 / 輕推CTA版). Use when the user pastes a comment or asks how to reply to something (e.g., '這個留言要怎麼回', '幫我回這則 Threads', '我該怎麼回應這個客戶'). Save to monitor_replies history.",
    input_schema: {
      type: "object" as const,
      properties: {
        source_text: {
          type: "string",
          description: "The comment / post text the user wants to reply to.",
        },
        source_type: {
          type: "string",
          description: "Where it's from: 'IG 留言', 'Threads 回覆', 'FB 訊息' etc. Optional.",
        },
        tone: {
          type: "string",
          description: "Desired tone, e.g., '友善熱情', '專業客服', '輕鬆幽默'. Optional.",
        },
        threads_url: {
          type: "string",
          description: "If from Threads and the user wants to be able to send the reply directly later, the post URL. Optional.",
        },
      },
      required: ["source_text"],
    },
  },
];

export type ReportToolInput = {
  focus?: string;
  tone?: string;
  length?: string;
  lang?: string;
};

export type ReportToolResult =
  | { ok: true; reportId: string; title: string; link: string }
  | { ok: false; error: string };

const VALID_TONES: Tone[] = ["professional", "business", "client", "internal", "casual", "data"];
const VALID_LENGTHS: Length[] = ["short", "standard", "detailed"];
const VALID_LANGS: Lang[] = ["zh", "en"];

export async function executeGenerateReport(
  supabase: SupabaseClient,
  brand: { id: string; name: string; agency_id: string },
  userId: string,
  input: ReportToolInput
): Promise<ReportToolResult> {
  const focus = String(input.focus ?? "").trim().slice(0, 200);
  if (!focus) return { ok: false, error: "missing focus — 請先告訴我這份報表的主題重點" };

  const tone: Tone = (VALID_TONES as string[]).includes(String(input.tone ?? ""))
    ? (input.tone as Tone)
    : "professional";
  const length: Length = (VALID_LENGTHS as string[]).includes(String(input.length ?? ""))
    ? (input.length as Length)
    : "standard";
  const lang: Lang = (VALID_LANGS as string[]).includes(String(input.lang ?? ""))
    ? (input.lang as Lang)
    : "zh";

  let chunks;
  try {
    chunks = await retrieveRelevantChunks(brand.id, focus, lang, 50);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "retrieve_failed" };
  }
  if (!isRelevant(chunks)) {
    return {
      ok: false,
      error: "no_relevant_data — 找不到與此主題相關的品牌資料，請先到 DATA 上傳對應檔期的素材",
    };
  }

  const opts: ReportOptions = { focus, sections: [], tone, length, lang };

  let result;
  try {
    result = await generateReportFromChunks(brand.name, chunks, opts);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "generation_failed" };
  }

  const title = makeAutoTitle(brand.name, focus, lang);

  const { data: report, error: insertErr } = await supabase
    .from("brand_reports")
    .insert({
      brand_id: brand.id,
      agency_id: brand.agency_id,
      user_id: userId,
      title,
      content: result.content,
      citations: result.citations,
      focus,
      style: null,
      style_colors: null,
      format: "markdown",
    })
    .select("id, title")
    .single();

  if (insertErr || !report) {
    return { ok: false, error: insertErr?.message ?? "save_failed" };
  }

  return {
    ok: true,
    reportId: report.id as string,
    title: report.title as string,
    link: `/brand/${brand.id}/reports/${report.id}`,
  };
}

// ─── generate_content tool ───────────────────────────

const VALID_CONTENT_TYPES: ContentType[] = [
  "ig_post",
  "fb_ad",
  "threads_post",
  "kol_brief",
  "campaign_plan",
  "email",
  "custom",
];

export type ContentToolInput = {
  type?: string;
  prompt?: string;
  audience?: string;
};

export type ContentToolResult =
  | { ok: true; outputId: string; type: ContentType; variants: string[]; link: string }
  | { ok: false; error: string };

export async function executeGenerateContent(
  supabase: SupabaseClient,
  brand: { id: string; name: string; agency_id: string },
  userId: string,
  input: ContentToolInput
): Promise<ContentToolResult> {
  const promptText = String(input.prompt ?? "").trim().slice(0, 2000);
  if (!promptText) return { ok: false, error: "missing_prompt" };

  const type: ContentType = (VALID_CONTENT_TYPES as string[]).includes(String(input.type ?? ""))
    ? (input.type as ContentType)
    : "ig_post";
  const audience = String(input.audience ?? "").trim().slice(0, 500);

  let result;
  try {
    result = await generateContentVariants(brand.id, brand.name, type, promptText, audience);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "generation_failed" };
  }

  const { data: row, error: insertErr } = await supabase
    .from("content_outputs")
    .insert({
      brand_id: brand.id,
      agency_id: brand.agency_id,
      user_id: userId,
      type,
      prompt: promptText,
      audience: audience || null,
      variants: result.variants,
      sources: result.sources,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    return { ok: false, error: insertErr?.message ?? "save_failed" };
  }

  return {
    ok: true,
    outputId: row.id as string,
    type,
    variants: result.variants,
    link: `/brand/${brand.id}/content`,
  };
}

// ─── generate_reply_suggestions tool ─────────────────

export type ReplyToolInput = {
  source_text?: string;
  source_type?: string;
  tone?: string;
  threads_url?: string;
};

export type ReplyToolResult =
  | { ok: true; replyId: string; suggestions: string[]; threads_url: string | null; link: string }
  | { ok: false; error: string };

export async function executeGenerateReplySuggestions(
  supabase: SupabaseClient,
  brand: { id: string; name: string; agency_id: string },
  userId: string,
  input: ReplyToolInput
): Promise<ReplyToolResult> {
  const sourceText = String(input.source_text ?? "").trim().slice(0, 4000);
  if (!sourceText) return { ok: false, error: "missing_source_text" };

  const sourceType = String(input.source_type ?? "").trim().slice(0, 60);
  const tone = String(input.tone ?? "").trim().slice(0, 120);
  const threadsUrl = String(input.threads_url ?? "").trim() || null;

  let result;
  try {
    result = await generateMonitorReplies(brand.id, brand.name, sourceText, sourceType, tone);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "generation_failed" };
  }

  const { data: row, error: insertErr } = await supabase
    .from("monitor_replies")
    .insert({
      brand_id: brand.id,
      agency_id: brand.agency_id,
      user_id: userId,
      source_text: sourceText,
      source_type: sourceType || null,
      tone: tone || null,
      suggestions: result.suggestions,
      threads_url: threadsUrl,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    return { ok: false, error: insertErr?.message ?? "save_failed" };
  }

  return {
    ok: true,
    replyId: row.id as string,
    suggestions: result.suggestions,
    threads_url: threadsUrl,
    link: `/brand/${brand.id}/monitor`,
  };
}
