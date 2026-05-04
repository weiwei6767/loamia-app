import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, CHAT_MODEL } from "@/lib/ai/anthropic";
import { retrieveContext, buildSystemPrompt, type Citation } from "@/lib/ai/rag";

export const runtime = "nodejs";

type ChatBody = {
  brandId: string;
  threadId?: string | null;
  content: string;
};

type ChatHistory = { role: "user" | "assistant"; content: string };

function ndjson(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

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

  // Fetch full thread history (for multi-turn context)
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("thread_id", activeThreadId)
    .order("created_at", { ascending: true });

  const messagesForClaude: ChatHistory[] =
    (history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })) ?? [];

  // RAG retrieval
  let citations: Citation[];
  try {
    citations = await retrieveContext(brand.id, content, 8);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "retrieve failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const systemPrompt = buildSystemPrompt(brand.name, citations);

  const stream = await anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: messagesForClaude.map((m) => ({ role: m.role, content: m.content })),
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Send thread info if newly created
        if (threadCreated) {
          controller.enqueue(
            ndjson({ type: "thread", id: activeThreadId, title: content.slice(0, 60).trim() })
          );
        }
        // Send citations up front
        controller.enqueue(ndjson({ type: "citations", data: citations }));

        let fullText = "";
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullText += event.delta.text;
            controller.enqueue(ndjson({ type: "text", delta: event.delta.text }));
          }
        }

        // Persist assistant message
        const { data: asstMsg } = await supabase
          .from("chat_messages")
          .insert({
            thread_id: activeThreadId,
            role: "assistant",
            content: fullText,
            citations,
          })
          .select("id")
          .single();

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
