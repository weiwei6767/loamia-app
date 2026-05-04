import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Uploader } from "./uploader";
import { Chat } from "./chat";
import { DocumentList } from "./document-list";
import { ThreadList } from "./thread-list";
import { BrandStatusToggle } from "./brand-status-toggle";

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

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { brandId } = await params;
  const { thread: threadIdRaw } = await searchParams;
  const threadId = threadIdRaw ?? null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, agency_id, status")
    .eq("id", brandId)
    .single();
  if (!brand) notFound();

  const [{ data: documents }, { data: threads }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, filename, status, byte_size, created_at, error_message")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("chat_threads")
      .select("id, title, created_at")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false }),
  ]);

  let initialMessages: StoredMessage[] = [];
  if (threadId) {
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("id, role, content, citations, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    initialMessages = (msgs ?? []) as StoredMessage[];
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 md:px-6 py-4 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/dashboard"
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
            >
              ← 返回
            </Link>
            <div className="min-w-0">
              <div className="text-xs font-mono tracking-widest text-[var(--accent)]">BRAND</div>
              <h1 className="text-lg font-bold truncate">{brand.name}</h1>
            </div>
          </div>
          <BrandStatusToggle brandId={brand.id} status={brand.status as "active" | "archived"} />
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_280px_1fr]">
        <aside className="border-r border-[var(--line)] p-5 lg:max-h-[calc(100vh-65px)] lg:overflow-y-auto">
          <ThreadList brandId={brand.id} threads={threads ?? []} currentThreadId={threadId} />
        </aside>

        <aside className="border-r border-[var(--line)] p-5 space-y-6 lg:max-h-[calc(100vh-65px)] lg:overflow-y-auto xl:block hidden">
          <section>
            <div className="text-xs font-mono tracking-widest text-[var(--muted)] mb-3">UPLOAD</div>
            <Uploader brandId={brand.id} />
          </section>
          <section>
            <div className="text-xs font-mono tracking-widest text-[var(--muted)] mb-3">DOCUMENTS</div>
            <DocumentList brandId={brand.id} documents={documents ?? []} />
          </section>
        </aside>

        <section className="lg:max-h-[calc(100vh-65px)]">
          <Chat
            key={threadId ?? "new"}
            brandId={brand.id}
            brandName={brand.name}
            threadId={threadId}
            initialMessages={initialMessages}
          />
        </section>
      </div>
    </main>
  );
}
