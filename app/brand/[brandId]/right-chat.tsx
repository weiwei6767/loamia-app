import { createClient } from "@/lib/supabase/server";
import { Chat } from "./chat";

type StoredCitation = {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  similarity: number;
};

type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: StoredCitation[] | null;
  created_at: string;
};

/**
 * Server component that loads the most recent chat thread for a brand and
 * renders the persistent right-column Brand GPT chat.
 */
export async function RightChat({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  const supabase = await createClient();
  const { data: latestThread } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const threadId = (latestThread?.id as string | undefined) ?? null;

  let initialMessages: StoredMessage[] = [];
  if (threadId) {
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("id, role, content, citations, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(50);
    initialMessages = (msgs ?? []) as StoredMessage[];
  }

  return (
    <Chat
      key={threadId ?? "new"}
      brandId={brandId}
      brandName={brandName}
      threadId={threadId}
      initialMessages={initialMessages}
    />
  );
}
