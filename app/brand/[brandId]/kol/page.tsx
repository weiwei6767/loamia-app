import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KolView } from "./kol-view";

export default async function KolPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .single();
  if (!brand) notFound();

  const { data: kols } = await supabase
    .from("brand_kols")
    .select(
      "id, name, handle, platform, profile_url, followers, niche_tags, contact_email, contact_phone, rate_note, status, campaign_name, brief, rate_paid, collab_notes, created_at"
    )
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl w-full px-4 md:px-6 py-8 space-y-6">
      <div>
        <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
          KOL · {(brand.name as string).toUpperCase()}
        </div>
        <h2 className="mt-1 text-2xl md:text-3xl font-bold">KOL 名單與合作</h2>
        <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
          累積品牌的 KOL 資產，每次新合作 AI 自動依 Brand Brain 產出客製化合作 brief，不用從零寫。
        </p>
      </div>

      <KolView
        brandId={brand.id}
        kols={(kols ?? []).map((k) => ({
          id: k.id as string,
          name: k.name as string,
          handle: (k.handle as string | null) ?? null,
          platform: (k.platform as string | null) ?? null,
          profile_url: (k.profile_url as string | null) ?? null,
          followers: (k.followers as number | null) ?? null,
          niche_tags: (k.niche_tags as string[] | null) ?? [],
          contact_email: (k.contact_email as string | null) ?? null,
          contact_phone: (k.contact_phone as string | null) ?? null,
          rate_note: (k.rate_note as string | null) ?? null,
          status: k.status as string,
          campaign_name: (k.campaign_name as string | null) ?? null,
          brief: (k.brief as string | null) ?? null,
          rate_paid: (k.rate_paid as string | null) ?? null,
          collab_notes: (k.collab_notes as string | null) ?? null,
          created_at: k.created_at as string,
        }))}
      />
    </div>
  );
}
