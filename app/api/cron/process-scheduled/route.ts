import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createPost } from "@/lib/threads/api";
import { computeNextRun, type Recurrence } from "@/lib/scheduler";
import { generateContentVariants } from "@/lib/ai/creative";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // permissive when no secret configured
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

type ScheduledRow = {
  id: string;
  agency_id: string;
  brand_id: string;
  text: string;
  platform: string;
  scheduled_at: string;
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
  next_run_at: string;
};

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();
  const result = {
    processed: 0,
    sent: 0,
    failed: 0,
    templates_run: 0,
    errors: [] as string[],
  };

  // ── 1. Templates due → generate post + insert into scheduled_posts (immediate) ──
  const { data: dueTemplates } = await supabase
    .from("post_templates")
    .select("id, agency_id, brand_id, user_id, prompt, recurrence, weekday, time_of_day, next_run_at")
    .eq("active", true)
    .lte("next_run_at", nowIso);

  for (const tmpl of (dueTemplates ?? []) as TemplateRow[]) {
    try {
      const { data: brand } = await supabase
        .from("brands")
        .select("name")
        .eq("id", tmpl.brand_id)
        .single();
      if (!brand) continue;

      // Use Brand Brain context via generateContentVariants (threads_post type)
      const result2 = await generateContentVariants(
        tmpl.brand_id,
        brand.name as string,
        "threads_post",
        tmpl.prompt,
        ""
      );
      const text = (result2.variants[0] ?? "").trim().slice(0, 500);
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

      const next = computeNextRun(new Date(), tmpl.recurrence, tmpl.time_of_day, tmpl.weekday);
      await supabase
        .from("post_templates")
        .update({ next_run_at: next.toISOString() })
        .eq("id", tmpl.id);

      result.templates_run += 1;
    } catch (err) {
      result.errors.push(
        `template ${tmpl.id}: ${err instanceof Error ? err.message : "fail"}`
      );
    }
  }

  // ── 2. Scheduled posts due → publish ──
  const { data: due } = await supabase
    .from("scheduled_posts")
    .select("id, agency_id, brand_id, text, platform, scheduled_at")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .limit(20);

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

  return NextResponse.json(result);
}
