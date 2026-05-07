import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  generateContentVariants,
  generateThreadsPostWithWebTools,
  type GenEvent,
} from "@/lib/ai/creative";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string; templateId: string }> }
) {
  const { brandId, templateId } = await params;
  if (!brandId || !templateId) {
    return new Response("missing params", { status: 400 });
  }

  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: brand } = await userClient
    .from("brands")
    .select("id, name, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return new Response("no access", { status: 403 });

  const { data: tmpl } = await userClient
    .from("post_templates")
    .select("id, prompt, enable_web_tools")
    .eq("id", templateId)
    .eq("brand_id", brandId)
    .single();
  if (!tmpl) return new Response("template not found", { status: 404 });

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        send("start", { templateId });
        const useAgent = Boolean(tmpl.enable_web_tools);

        let preview = "";
        if (useAgent) {
          const service = createServiceClient();
          const result = await generateThreadsPostWithWebTools(
            service,
            {
              id: brand.id as string,
              agency_id: brand.agency_id as string,
              name: brand.name as string,
            },
            user.id,
            tmpl.prompt as string,
            (e: GenEvent) => send("progress", e)
          );
          preview = result.text.trim().slice(0, 500);
        } else {
          send("progress", { stage: "context" });
          send("progress", { stage: "writing" });
          const result = await generateContentVariants(
            brand.id as string,
            brand.name as string,
            "threads_post",
            tmpl.prompt as string,
            ""
          );
          preview = (result.variants[0] ?? "").trim().slice(0, 500);
        }

        // Save as locked next-post text
        const service = createServiceClient();
        await service
          .from("post_templates")
          .update({ next_post_text: preview })
          .eq("id", templateId);

        send("done", { preview });
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "preview failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
