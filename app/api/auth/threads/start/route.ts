import { NextResponse, type NextRequest } from "next/server";
import { buildAuthorizeUrl } from "@/lib/threads/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brandId");
  if (!brandId) {
    return new NextResponse("missing brandId", { status: 400 });
  }
  if (!process.env.THREADS_APP_ID || !process.env.THREADS_REDIRECT_URI) {
    return new NextResponse("Threads API not configured", { status: 500 });
  }
  const url = buildAuthorizeUrl(brandId);
  return NextResponse.redirect(url);
}
