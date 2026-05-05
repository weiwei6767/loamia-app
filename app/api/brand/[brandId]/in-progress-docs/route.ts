import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params;
  if (!brandId) return NextResponse.json({ items: [] });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [] }, { status: 401 });

  const { data } = await supabase
    .from("documents")
    .select("id, filename, status, progress_pct, error_message")
    .eq("brand_id", brandId)
    .eq("status", "processing")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    items: (data ?? []).map((d) => ({
      id: d.id as string,
      filename: d.filename as string,
      status: d.status as string,
      progress: (d.progress_pct as number | null) ?? 0,
      error: (d.error_message as string | null) ?? null,
    })),
  });
}
