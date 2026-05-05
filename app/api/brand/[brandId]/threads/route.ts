import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("chat_threads")
    .select("id, title, created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    threads: (data ?? []).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      created_at: t.created_at as string,
    })),
  });
}
