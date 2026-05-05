import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runScheduler } from "@/lib/scheduler-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params;
  if (!brandId) return NextResponse.json({ error: "missing brandId" }, { status: 400 });

  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Verify the user has access to the brand (RLS will enforce on this select)
  const { data: brand } = await userClient
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .single();
  if (!brand) return NextResponse.json({ error: "no access" }, { status: 403 });

  // Use service client to actually run (bypass RLS for sending logic)
  const service = createServiceClient();
  const result = await runScheduler(service, brandId);
  return NextResponse.json(result);
}
