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
      "Generate 3 AI reply suggestions for a social comment / post the user pastes (Engagement Engine: 自然分享版 / 專業解答版 / 輕推CTA版). Use when the user pastes a comment or asks how to reply to something. Save to monitor_replies history.",
    input_schema: {
      type: "object" as const,
      properties: {
        source_text: { type: "string", description: "The comment / post text to reply to." },
        source_type: { type: "string", description: "'IG 留言', 'Threads 回覆' etc. Optional." },
        tone: { type: "string", description: "'友善熱情', '專業客服' etc. Optional." },
        threads_url: { type: "string", description: "Threads URL for direct send later. Optional." },
      },
      required: ["source_text"],
    },
  },
  // ── READ tools ─────────────────────────────────────
  {
    name: "list_documents",
    description: "List the brand's uploaded documents in DATA. Use to survey what materials are available before generating reports/content.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max rows. Default 20." },
        tag: { type: "string", description: "Filter by single tag (e.g., 'competitor'). Optional." },
      },
    },
  },
  {
    name: "list_kols",
    description: "List the brand's KOL roster. Use when user asks who's on KOL list or to check KOL status.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["researching", "contacted", "in_progress", "completed", "paused", "rejected", "all"],
          description: "Filter by status. Default 'all'.",
        },
      },
    },
  },
  {
    name: "list_scheduled_posts",
    description: "List scheduled posts. Use when user asks what's queued or what's pending.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["pending", "sent", "failed", "cancelled", "all"],
          description: "Default 'pending'.",
        },
      },
    },
  },
  {
    name: "list_post_templates",
    description: "List active recurring AI post templates.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_recent_replies",
    description: "List recent monitor replies (Coast Guard) — generated reply suggestions, sent records, outcomes.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Default 10." },
      },
    },
  },
  {
    name: "get_brand_identity",
    description: "Fetch the brand's Brand Identity (Layer 1) — positioning, target audience, tone, taboo words. Useful when user asks about own brand.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_competitors",
    description: "List competitor intelligence entries (Layer 2 of Brand Brain).",
    input_schema: { type: "object" as const, properties: {} },
  },
  // ── WRITE tools ────────────────────────────────────
  {
    name: "schedule_post",
    description: "Schedule a Threads post for future delivery. The text is sent verbatim. For destructive or multi-post operations, use propose_plan first.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Post content, max 500 chars." },
        scheduled_at_iso: {
          type: "string",
          description: "ISO 8601 UTC timestamp when to send (e.g., '2026-05-10T01:00:00.000Z'). Must be in the future.",
        },
      },
      required: ["text", "scheduled_at_iso"],
    },
  },
  {
    name: "create_kol",
    description: "Add a new KOL to the brand's roster. Only required field is name.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        handle: { type: "string", description: "Username without @." },
        platform: {
          type: "string",
          enum: ["threads", "instagram", "youtube", "tiktok", "facebook", "x", "other"],
        },
        followers: { type: "number" },
        niche_tags: { type: "array", items: { type: "string" }, description: "Niche/topic tags." },
        contact_email: { type: "string" },
        rate_note: { type: "string", description: "Rate / fee note." },
      },
      required: ["name"],
    },
  },
  {
    name: "update_kol_status",
    description: "Change a KOL's collaboration status. Use when user asks to mark a KOL as 'contacted' / 'in progress' etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        kol_id: { type: "string", description: "KOL UUID." },
        status: {
          type: "string",
          enum: ["researching", "contacted", "in_progress", "completed", "paused", "rejected"],
        },
      },
      required: ["kol_id", "status"],
    },
  },
  {
    name: "mark_reply_outcome",
    description: "Mark a monitor reply's outcome (replied / converted / ignored) for Feedback Loop learning.",
    input_schema: {
      type: "object" as const,
      properties: {
        reply_id: { type: "string" },
        outcome: { type: "string", enum: ["replied", "converted", "ignored"] },
      },
      required: ["reply_id", "outcome"],
    },
  },
  {
    name: "run_scheduler_now",
    description: "Manually trigger the scheduler to process all due scheduled posts and templates. Use when user says '立即發送' or '不要等 cron'.",
    input_schema: { type: "object" as const, properties: {} },
  },
  // ── PLAN tool (must be used before destructive / multi-step) ──
  {
    name: "propose_plan",
    description:
      "Propose a multi-step plan for the user to review BEFORE executing. MUST be called first when: (1) the action involves DELETE / CANCEL / batch operations, (2) the request requires 3+ tool calls, (3) the operation has irreversible effects. Returns the plan to the user as a confirmation card. After user confirms, you proceed with the actual tool calls.",
    input_schema: {
      type: "object" as const,
      properties: {
        goal: { type: "string", description: "One-sentence summary of what the user wants." },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string", description: "Short action name e.g. 'schedule_post', 'cancel_pending'." },
              description: { type: "string", description: "What this step does in plain Chinese." },
            },
            required: ["action", "description"],
          },
          description: "Ordered list of steps you intend to perform.",
        },
        warnings: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Things the user should be aware of (irreversibility, cost, etc.).",
        },
      },
      required: ["goal", "steps"],
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

// ─── READ tool executors ───────────────────────────

export async function executeListDocuments(
  supabase: SupabaseClient,
  brandId: string,
  input: { limit?: number; tag?: string }
) {
  const limit = Math.min(50, input.limit ?? 20);
  let query = supabase
    .from("documents")
    .select("id, filename, status, byte_size, tags, created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (input.tag) query = query.contains("tags", [input.tag]);
  const { data } = await query;
  return { ok: true, count: data?.length ?? 0, documents: data ?? [] };
}

export async function executeListKols(
  supabase: SupabaseClient,
  brandId: string,
  input: { status?: string }
) {
  let query = supabase
    .from("brand_kols")
    .select("id, name, handle, platform, followers, niche_tags, status, campaign_name")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (input.status && input.status !== "all") query = query.eq("status", input.status);
  const { data } = await query;
  return { ok: true, count: data?.length ?? 0, kols: data ?? [] };
}

export async function executeListScheduledPosts(
  supabase: SupabaseClient,
  brandId: string,
  input: { status?: string }
) {
  const status = input.status ?? "pending";
  let query = supabase
    .from("scheduled_posts")
    .select("id, text, scheduled_at, status, sent_at, error_message")
    .eq("brand_id", brandId)
    .order("scheduled_at", { ascending: false })
    .limit(30);
  if (status !== "all") query = query.eq("status", status);
  const { data } = await query;
  return { ok: true, count: data?.length ?? 0, posts: data ?? [] };
}

export async function executeListPostTemplates(supabase: SupabaseClient, brandId: string) {
  const { data } = await supabase
    .from("post_templates")
    .select("id, name, prompt, recurrence, weekday, time_of_day, next_run_at, active")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  return { ok: true, count: data?.length ?? 0, templates: data ?? [] };
}

export async function executeListRecentReplies(
  supabase: SupabaseClient,
  brandId: string,
  input: { limit?: number }
) {
  const limit = Math.min(30, input.limit ?? 10);
  const { data } = await supabase
    .from("monitor_replies")
    .select("id, source_text, tone, sent_at, sent_platform, outcome, created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { ok: true, count: data?.length ?? 0, replies: data ?? [] };
}

export async function executeGetBrandIdentity(supabase: SupabaseClient, brandId: string) {
  const { data } = await supabase
    .from("brands")
    .select("name, positioning, target_audience, tone_guide, taboo_words")
    .eq("id", brandId)
    .single();
  if (!data) return { ok: false, error: "找不到品牌" };
  return { ok: true, identity: data };
}

export async function executeListCompetitors(supabase: SupabaseClient, brandId: string) {
  const { data } = await supabase
    .from("brand_intelligence")
    .select("id, category, title, content, source, created_at")
    .eq("brand_id", brandId)
    .eq("category", "competitor")
    .order("created_at", { ascending: false });
  return { ok: true, count: data?.length ?? 0, competitors: data ?? [] };
}

// ─── WRITE / UPDATE tool executors ─────────────────

export async function executeSchedulePost(
  supabase: SupabaseClient,
  brand: { id: string; agency_id: string },
  userId: string,
  input: { text?: string; scheduled_at_iso?: string }
) {
  const text = String(input.text ?? "").trim().slice(0, 500);
  const dt = input.scheduled_at_iso ? new Date(input.scheduled_at_iso) : null;
  if (!text) return { ok: false, error: "missing text" };
  if (!dt || Number.isNaN(dt.getTime())) return { ok: false, error: "invalid scheduled_at_iso" };
  if (dt.getTime() < Date.now() - 60_000) return { ok: false, error: "scheduled_at must be in the future" };

  const { data, error } = await supabase
    .from("scheduled_posts")
    .insert({
      agency_id: brand.agency_id,
      brand_id: brand.id,
      user_id: userId,
      platform: "threads",
      text,
      scheduled_at: dt.toISOString(),
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "save_failed" };
  return {
    ok: true,
    postId: data.id,
    scheduled_at: dt.toISOString(),
    link: `/brand/${brand.id}/schedule`,
  };
}

export async function executeCreateKol(
  supabase: SupabaseClient,
  brand: { id: string; agency_id: string },
  userId: string,
  input: {
    name?: string;
    handle?: string;
    platform?: string;
    followers?: number;
    niche_tags?: string[];
    contact_email?: string;
    rate_note?: string;
  }
) {
  const name = String(input.name ?? "").trim().slice(0, 200);
  if (!name) return { ok: false, error: "missing name" };

  const validPlatforms = ["threads", "instagram", "youtube", "tiktok", "facebook", "x", "other"];
  const platform = validPlatforms.includes(String(input.platform ?? ""))
    ? (input.platform as string)
    : null;

  const { data, error } = await supabase
    .from("brand_kols")
    .insert({
      agency_id: brand.agency_id,
      brand_id: brand.id,
      user_id: userId,
      name,
      handle: input.handle?.trim().slice(0, 100) || null,
      platform,
      followers: typeof input.followers === "number" ? input.followers : null,
      niche_tags: Array.isArray(input.niche_tags) ? input.niche_tags.slice(0, 15) : null,
      contact_email: input.contact_email?.trim().slice(0, 200) || null,
      rate_note: input.rate_note?.trim().slice(0, 500) || null,
      status: "researching",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "save_failed" };
  return { ok: true, kolId: data.id, link: `/brand/${brand.id}/kol` };
}

export async function executeUpdateKolStatus(
  supabase: SupabaseClient,
  brandId: string,
  input: { kol_id?: string; status?: string }
) {
  const validStatuses = [
    "researching",
    "contacted",
    "in_progress",
    "completed",
    "paused",
    "rejected",
  ];
  if (!input.kol_id || !input.status || !validStatuses.includes(input.status)) {
    return { ok: false, error: "missing or invalid fields" };
  }
  const { error } = await supabase
    .from("brand_kols")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.kol_id)
    .eq("brand_id", brandId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, link: `/brand/${brandId}/kol` };
}

export async function executeMarkReplyOutcome(
  supabase: SupabaseClient,
  brandId: string,
  input: { reply_id?: string; outcome?: string }
) {
  const validOutcomes = ["replied", "converted", "ignored"];
  if (!input.reply_id || !input.outcome || !validOutcomes.includes(input.outcome)) {
    return { ok: false, error: "missing or invalid fields" };
  }
  const { error } = await supabase
    .from("monitor_replies")
    .update({ outcome: input.outcome })
    .eq("id", input.reply_id)
    .eq("brand_id", brandId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, link: `/brand/${brandId}/monitor` };
}

// ─── PLAN tool — just returns the plan to the client for confirmation ──

export type PlanInput = {
  goal?: string;
  steps?: Array<{ action: string; description: string }>;
  warnings?: string[];
};

export function executeProposePlan(input: PlanInput) {
  return {
    ok: true,
    awaiting_confirmation: true,
    plan: {
      goal: input.goal ?? "",
      steps: Array.isArray(input.steps) ? input.steps : [],
      warnings: Array.isArray(input.warnings) ? input.warnings : [],
    },
  };
}
