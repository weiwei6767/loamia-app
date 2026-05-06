import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPost, createReply } from "@/lib/threads/api";
import { computeNextRun, type Recurrence } from "@/lib/scheduler";
import { generateContentVariants } from "@/lib/ai/creative";

export type RunResult = {
  processed: number;
  sent: number;
  failed: number;
  templates_run: number;
  errors: string[];
};

type ScheduledRow = {
  id: string;
  agency_id: string;
  brand_id: string;
  text: string;
  platform: string;
  scheduled_at: string;
  template_id: string | null;
};

type TemplateRow = {
  id: string;
  agency_id: string;
  brand_id: string;
  user_id: string | null;
  prompt: string;
  recurrence: Recurrence;
  weekday: number | null;
  time_of_day: string;
  interval_hours: number | null;
  tz_offset_minutes: number | null;
  next_run_at: string;
  next_post_text: string | null;
  comments: string[] | null;
};

/**
 * Run the scheduler. Optionally scoped to a single brand_id.
 *
 * 1. For each due active template → call AI to generate post → insert into scheduled_posts
 * 2. For each due pending scheduled_posts → call Threads API to publish
 */
export async function runScheduler(
  supabase: SupabaseClient,
  scopeBrandId?: string
): Promise<RunResult> {
  const result: RunResult = { processed: 0, sent: 0, failed: 0, templates_run: 0, errors: [] };
  const nowIso = new Date().toISOString();

  // ── Templates due ──
  let tmplQuery = supabase
    .from("post_templates")
    .select(
      "id, agency_id, brand_id, user_id, prompt, recurrence, weekday, time_of_day, interval_hours, tz_offset_minutes, next_run_at, next_post_text, comments"
    )
    .eq("active", true)
    .lte("next_run_at", nowIso);
  if (scopeBrandId) tmplQuery = tmplQuery.eq("brand_id", scopeBrandId);
  const { data: dueTemplates } = await tmplQuery;

  for (const tmpl of (dueTemplates ?? []) as TemplateRow[]) {
    try {
      const { data: brand } = await supabase
        .from("brands")
        .select("name")
        .eq("id", tmpl.brand_id)
        .single();
      if (!brand) continue;

      // Use locked next_post_text if pre-staged by user, else generate fresh via AI
      let text: string;
      if (tmpl.next_post_text && tmpl.next_post_text.trim()) {
        text = tmpl.next_post_text.trim().slice(0, 500);
      } else {
        const aiResult = await generateContentVariants(
          tmpl.brand_id,
          brand.name as string,
          "threads_post",
          tmpl.prompt,
          ""
        );
        text = (aiResult.variants[0] ?? "").trim().slice(0, 500);
      }
      if (!text) {
        result.errors.push(`template ${tmpl.id}: empty AI output`);
        continue;
      }

      await supabase.from("scheduled_posts").insert({
        agency_id: tmpl.agency_id,
        brand_id: tmpl.brand_id,
        user_id: tmpl.user_id,
        platform: "threads",
        text,
        scheduled_at: new Date().toISOString(),
        status: "pending",
        template_id: tmpl.id,
      });

      const next = computeNextRun(
        new Date(),
        tmpl.recurrence,
        tmpl.time_of_day,
        tmpl.weekday,
        tmpl.tz_offset_minutes ?? 0,
        tmpl.interval_hours ?? null
      );
      // Clear next_post_text after use so the next cycle generates fresh
      await supabase
        .from("post_templates")
        .update({ next_run_at: next.toISOString(), next_post_text: null })
        .eq("id", tmpl.id);

      result.templates_run += 1;
    } catch (err) {
      result.errors.push(
        `template ${tmpl.id}: ${err instanceof Error ? err.message : "fail"}`
      );
    }
  }

  // ── Scheduled posts due ──
  let postsQuery = supabase
    .from("scheduled_posts")
    .select("id, agency_id, brand_id, text, platform, scheduled_at, template_id")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .limit(20);
  if (scopeBrandId) postsQuery = postsQuery.eq("brand_id", scopeBrandId);
  const { data: due } = await postsQuery;

  for (const post of (due ?? []) as ScheduledRow[]) {
    result.processed += 1;
    try {
      if (post.platform !== "threads") {
        await supabase
          .from("scheduled_posts")
          .update({
            status: "failed",
            error_message: `unsupported platform ${post.platform}`,
          })
          .eq("id", post.id);
        result.failed += 1;
        continue;
      }

      const { data: conn } = await supabase
        .from("social_connections")
        .select("access_token, platform_user_id")
        .eq("brand_id", post.brand_id)
        .eq("platform", "threads")
        .single();
      if (!conn?.access_token || !conn?.platform_user_id) {
        await supabase
          .from("scheduled_posts")
          .update({
            status: "failed",
            error_message: "Threads 帳號尚未連接或 token 失效",
          })
          .eq("id", post.id);
        result.failed += 1;
        continue;
      }

      const sent = await createPost(
        conn.platform_user_id as string,
        conn.access_token as string,
        post.text
      );
      await supabase
        .from("scheduled_posts")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_post_id: sent.id,
        })
        .eq("id", post.id);
      result.sent += 1;

      // If post came from a template, post its comments under the new post in order
      if (post.template_id) {
        const { data: tmpl } = await supabase
          .from("post_templates")
          .select("comments")
          .eq("id", post.template_id)
          .single();
        const comments = (tmpl?.comments as string[] | null) ?? [];
        for (let i = 0; i < comments.length; i++) {
          const commentText = (comments[i] ?? "").trim().slice(0, 500);
          if (!commentText) continue;
          try {
            await createReply(
              conn.platform_user_id as string,
              conn.access_token as string,
              commentText,
              sent.id
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : "comment failed";
            result.errors.push(`post ${post.id} comment ${i + 1}: ${msg}`);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "send failed";
      await supabase
        .from("scheduled_posts")
        .update({ status: "failed", error_message: msg })
        .eq("id", post.id);
      result.failed += 1;
      result.errors.push(`post ${post.id}: ${msg}`);
    }
  }

  return result;
}
