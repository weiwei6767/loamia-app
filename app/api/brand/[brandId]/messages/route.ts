import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params;
  const threadId = req.nextUrl.searchParams.get("threadId");
  if (!threadId) return NextResponse.json({ messages: [] });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // verify access to brand (RLS will scope via thread relationship anyway)
  const { data: thread } = await supabase
    .from("chat_threads")
    .select("id, brand_id")
    .eq("id", threadId)
    .single();
  if (!thread || thread.brand_id !== brandId) {
    return NextResponse.json({ messages: [] });
  }

  const { data } = await supabase
    .from("chat_messages")
    .select("id, role, content, citations, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200);

  return NextResponse.json({ messages: data ?? [] });
}
