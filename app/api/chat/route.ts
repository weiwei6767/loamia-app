import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, CHAT_MODEL } from "@/lib/ai/anthropic";
import { retrieveContext, buildSystemPrompt, type Citation } from "@/lib/ai/rag";
import { CHAT_TOOLS, executeGenerateReport, type ReportToolInput } from "@/lib/ai/tools";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatBody = {
  brandId: string;
  threadId?: string | null;
  content: string;
};

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[] | { type: "tool_result"; tool_use_id: string; content: string }[];
};

function ndjson(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

const MAX_AGENT_ITERATIONS = 4;

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { brandId, threadId, content } = body;
  if (!brandId || !content?.trim()) {
    return NextResponse.json({ error: "missing brandId or content" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  // Get or create thread
  let activeThreadId = threadId ?? null;
  let threadCreated = false;

  if (!activeThreadId) {
    const title = content.slice(0, 60).trim() || "New chat";
    const { data: newThread, error: tErr } = await supabase
      .from("chat_threads")
      .insert({
        brand_id: brand.id,
        agency_id: brand.agency_id,
        user_id: user.id,
        title,
      })
      .select("id, title")
      .single();
    if (tErr || !newThread) {
      return NextResponse.json({ error: tErr?.message ?? "create thread failed" }, { status: 500 });
    }
    activeThreadId = newThread.id;
    threadCreated = true;
  }

  // Insert user message
  const { data: userMsg, error: userErr } = await supabase
    .from("chat_messages")
    .insert({ thread_id: activeThreadId, role: "user", content })
    .select("id")
    .single();
  if (userErr || !userMsg) {
    return NextResponse.json({ error: userErr?.message ?? "insert user msg failed" }, { status: 500 });
  }

  // Fetch full thread history
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("thread_id", activeThreadId)
    .order("created_at", { ascending: true });

  const claudeMessages: ClaudeMessage[] = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content as string,
  }));

  // RAG retrieval
  let citations: Citation[];
  try {
    citations = await retrieveContext(brand.id, content, 8);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "retrieve failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const systemPrompt = buildSystemPrompt(brand.name, citations);
  const client = await anthropic();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        if (threadCreated) {
          controller.enqueue(
            ndjson({ type: "thread", id: activeThreadId, title: content.slice(0, 60).trim() })
          );
        }
        controller.enqueue(ndjson({ type: "citations", data: citations }));

        let fullText = "";
        const toolEventsForPersistence: Array<{ name: string; input: unknown; result: unknown }> = [];

        for (let iter = 0; iter < MAX_AGENT_ITERATIONS; iter++) {
          const stream = client.messages.stream({
            model: CHAT_MODEL,
            max_tokens: 2048,
            system: systemPrompt,
            tools: CHAT_TOOLS,
            messages: claudeMessages.map((m) => ({
              role: m.role,
              content: m.content as never,
            })),
          });

          // accumulate blocks during streaming
          const partialBlocks: Record<number, { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; partialJson: string }> = {};

          for await (const event of stream) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "text") {
                partialBlocks[event.index] = { type: "text", text: "" };
              } else if (event.content_block.type === "tool_use") {
                partialBlocks[event.index] = {
                  type: "tool_use",
                  id: event.content_block.id,
                  name: event.content_block.name,
                  partialJson: "",
                };
                controller.enqueue(
                  ndjson({
                    type: "tool_call_start",
                    id: event.content_block.id,
                    name: event.content_block.name,
                  })
                );
              }
            } else if (event.type === "content_block_delta") {
              const block = partialBlocks[event.index];
              if (event.delta.type === "text_delta" && block?.type === "text") {
                block.text += event.delta.text;
                fullText += event.delta.text;
                controller.enqueue(ndjson({ type: "text", delta: event.delta.text }));
              } else if (event.delta.type === "input_json_delta" && block?.type === "tool_use") {
                block.partialJson += event.delta.partial_json;
              }
            }
          }

          const finalMsg = await stream.finalMessage();

          // Detect tool uses
          const toolUses = finalMsg.content.filter(
            (b): b is { type: "tool_use"; id: string; name: string; input: unknown } =>
              b.type === "tool_use"
          );

          if (toolUses.length === 0) {
            break;
          }

          // Append assistant message (with tool_use blocks) to history
          claudeMessages.push({
            role: "assistant",
            content: finalMsg.content as AnthropicContentBlock[],
          });

          // Execute tools
          const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];
          for (const tu of toolUses) {
            let resultPayload: unknown;
            if (tu.name === "generate_report") {
              const r = await executeGenerateReport(
                supabase,
                brand,
                user.id,
                tu.input as ReportToolInput
              );
              resultPayload = r;
            } else {
              resultPayload = { ok: false, error: `unknown tool: ${tu.name}` };
            }

            controller.enqueue(
              ndjson({
                type: "tool_result",
                id: tu.id,
                name: tu.name,
                input: tu.input,
                result: resultPayload,
              })
            );

            toolEventsForPersistence.push({ name: tu.name, input: tu.input, result: resultPayload });

            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify(resultPayload),
            });
          }

          claudeMessages.push({ role: "user", content: toolResults });
        }

        // Persist assistant message
        const insertPayload: Record<string, unknown> = {
          thread_id: activeThreadId,
          role: "assistant",
          content: fullText,
          citations,
        };
        if (toolEventsForPersistence.length > 0) {
          insertPayload.tool_events = toolEventsForPersistence;
        }
        const { data: asstMsg } = await supabase
          .from("chat_messages")
          .insert(insertPayload)
          .select("id")
          .single();

        // Revalidate reports page if any reports were generated
        if (toolEventsForPersistence.some((e) => e.name === "generate_report")) {
          revalidatePath(`/brand/${brandId}/reports`);
        }

        controller.enqueue(
          ndjson({
            type: "done",
            userMessageId: userMsg.id,
            assistantMessageId: asstMsg?.id ?? null,
          })
        );
        controller.close();
      } catch (err) {
        controller.enqueue(
          ndjson({ type: "error", message: err instanceof Error ? err.message : "stream failed" })
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
