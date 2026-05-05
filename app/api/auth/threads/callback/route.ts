import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForShortToken,
  exchangeForLongLivedToken,
  getMe,
  THREADS_SCOPES,
} from "@/lib/threads/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const brandId = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");
  const errorDesc = req.nextUrl.searchParams.get("error_description");

  if (errorParam || !code || !brandId) {
    const msg = encodeURIComponent(errorDesc ?? errorParam ?? "missing code/state");
    return NextResponse.redirect(
      new URL(`/brand/${brandId ?? ""}/monitor?threads_error=${msg}`, req.url)
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) {
    return NextResponse.redirect(
      new URL(`/dashboard?threads_error=brand_not_found`, req.url)
    );
  }

  try {
    const shortToken = await exchangeCodeForShortToken(code);
    const longToken = await exchangeForLongLivedToken(shortToken.access_token);
    const me = await getMe(longToken.access_token);

    const expiresAt = new Date(Date.now() + longToken.expires_in * 1000).toISOString();

    const { error: upsertErr } = await supabase
      .from("social_connections")
      .upsert(
        {
          agency_id: brand.agency_id,
          user_id: user.id,
          brand_id: brand.id,
          platform: "threads",
          platform_user_id: me.id,
          username: me.username,
          access_token: longToken.access_token,
          token_expires_at: expiresAt,
          scopes: THREADS_SCOPES.split(","),
        },
        { onConflict: "brand_id,platform" }
      );
    if (upsertErr) {
      throw new Error(`db upsert failed: ${upsertErr.message}`);
    }

    return NextResponse.redirect(
      new URL(`/brand/${brandId}/monitor?threads_connected=1`, req.url)
    );
  } catch (err) {
    const msg = encodeURIComponent(
      err instanceof Error ? err.message : "unknown OAuth error"
    );
    return NextResponse.redirect(
      new URL(`/brand/${brandId}/monitor?threads_error=${msg}`, req.url)
    );
  }
}
