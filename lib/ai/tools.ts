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
