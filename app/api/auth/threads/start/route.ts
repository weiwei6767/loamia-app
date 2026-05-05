import { NextResponse, type NextRequest } from "next/server";
import { buildAuthorizeUrl } from "@/lib/threads/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brandId");
  if (!brandId) {
    return new NextResponse("missing brandId", { status: 400 });
  }
  const missing: string[] = [];
  if (!process.env.THREADS_APP_ID) missing.push("THREADS_APP_ID");
  if (!process.env.THREADS_APP_SECRET) missing.push("THREADS_APP_SECRET");
  if (!process.env.THREADS_REDIRECT_URI) missing.push("THREADS_REDIRECT_URI");
  if (missing.length) {
    return new NextResponse(`Threads API not configured: missing ${missing.join(", ")}`, {
      status: 500,
    });
  }
  const url = buildAuthorizeUrl(brandId);
  return NextResponse.redirect(url);
}
