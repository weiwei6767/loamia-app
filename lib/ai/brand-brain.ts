import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BrandIdentity = {
  name: string;
  positioning: string | null;
  target_audience: string | null;
  tone_guide: string | null;
  taboo_words: string[] | null;
};

export type IntelligenceItem = {
  id: string;
  category: "competitor" | "market_trend" | "industry_term" | "audience_insight";
  title: string;
  content: string;
  source: string | null;
};

export type WinningPattern = {
  id: string;
  pattern_type: "reply" | "caption" | "subject_line" | "hook";
  example_text: string;
  context_summary: string | null;
  outcome_score: number | null;
};

export type BrandBrainContext = {
  identity: BrandIdentity;
  intelligence: IntelligenceItem[];
  winning: WinningPattern[];
};

export async function fetchBrandIdentity(
  supabase: SupabaseClient,
  brandId: string
): Promise<BrandIdentity | null> {
  const { data } = await supabase
    .from("brands")
    .select("name, positioning, target_audience, tone_guide, taboo_words")
    .eq("id", brandId)
    .single();
  if (!data) return null;
  return {
    name: data.name as string,
    positioning: (data.positioning as string | null) ?? null,
    target_audience: (data.target_audience as string | null) ?? null,
    tone_guide: (data.tone_guide as string | null) ?? null,
    taboo_words: (data.taboo_words as string[] | null) ?? null,
  };
}

export async function fetchIntelligence(
  supabase: SupabaseClient,
  brandId: string,
  limit = 10
): Promise<IntelligenceItem[]> {
  const { data } = await supabase
    .from("brand_intelligence")
    .select("id, category, title, content, source")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as IntelligenceItem[];
}

export async function fetchWinningPatterns(
  supabase: SupabaseClient,
  brandId: string,
  patternType?: WinningPattern["pattern_type"],
  limit = 5
): Promise<WinningPattern[]> {
  let query = supabase
    .from("winning_patterns")
    .select("id, pattern_type, example_text, context_summary, outcome_score")
    .eq("brand_id", brandId)
    .order("outcome_score", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (patternType) query = query.eq("pattern_type", patternType);
  const { data } = await query;
  return (data ?? []) as WinningPattern[];
}

export async function assembleBrandBrainContext(
  supabase: SupabaseClient,
  brandId: string,
  patternType?: WinningPattern["pattern_type"]
): Promise<BrandBrainContext | null> {
  const [identity, intelligence, winning] = await Promise.all([
    fetchBrandIdentity(supabase, brandId),
    fetchIntelligence(supabase, brandId, 10),
    fetchWinningPatterns(supabase, brandId, patternType, 5),
  ]);
  if (!identity) return null;
  return { identity, intelligence, winning };
}

export function formatBrandBrainPrompt(ctx: BrandBrainContext): string {
  const sections: string[] = [];

  // Layer 1: Brand Identity
  const idLines: string[] = [`品牌名稱：${ctx.identity.name}`];
  if (ctx.identity.positioning) idLines.push(`定位：${ctx.identity.positioning}`);
  if (ctx.identity.target_audience) idLines.push(`目標受眾：${ctx.identity.target_audience}`);
  if (ctx.identity.tone_guide) idLines.push(`語氣指南：${ctx.identity.tone_guide}`);
  if (ctx.identity.taboo_words && ctx.identity.taboo_words.length > 0) {
    idLines.push(`禁忌詞：${ctx.identity.taboo_words.join(", ")}`);
  }
  sections.push(`## Brand Identity（我是誰）\n${idLines.join("\n")}`);

  // Layer 2: Market Intelligence
  if (ctx.intelligence.length > 0) {
    const lines = ctx.intelligence.map((i) => {
      const cat = (
        { competitor: "競品", market_trend: "市場趨勢", industry_term: "產業術語", audience_insight: "受眾洞察" } as const
      )[i.category];
      return `- [${cat}] ${i.title}：${i.content}`;
    });
    sections.push(`## Market Intelligence（外部世界）\n${lines.join("\n")}`);
  }

  // Layer 3: Winning Memory
  if (ctx.winning.length > 0) {
    const lines = ctx.winning.map((w) => {
      const score = w.outcome_score ? ` (成效 ${w.outcome_score}/10)` : "";
      const ctxLine = w.context_summary ? `\n  情境：${w.context_summary}` : "";
      return `- ${w.example_text}${score}${ctxLine}`;
    });
    sections.push(`## Winning Memory（什麼有效）\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

// Convenience: derive a winning pattern from a converted monitor reply
export async function recordWinningReplyFromMonitor(
  supabase: SupabaseClient,
  replyRow: {
    id: string;
    brand_id: string;
    agency_id: string;
    sent_text: string | null;
    source_text: string | null;
    outcome: string | null;
    tone: string | null;
  }
): Promise<void> {
  if (!replyRow.sent_text || replyRow.outcome !== "converted") return;
  // avoid duplicates
  const { data: existing } = await supabase
    .from("winning_patterns")
    .select("id")
    .eq("source_id", replyRow.id)
    .maybeSingle();
  if (existing) return;

  const contextParts: string[] = [];
  if (replyRow.source_text) contextParts.push(`原貼文：${replyRow.source_text.slice(0, 200)}`);
  if (replyRow.tone) contextParts.push(`語氣：${replyRow.tone}`);

  await supabase.from("winning_patterns").insert({
    agency_id: replyRow.agency_id,
    brand_id: replyRow.brand_id,
    pattern_type: "reply",
    example_text: replyRow.sent_text,
    context_summary: contextParts.join(" / ") || null,
    source_table: "monitor_replies",
    source_id: replyRow.id,
    outcome_score: 9,
  });
}
