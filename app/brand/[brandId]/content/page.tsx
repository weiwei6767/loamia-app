import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BrandStatusToggle } from "../brand-status-toggle";
import { ContentView } from "./content-view";

type ContentRow = {
  id: string;
  type: string;
  prompt: string;
  audience: string | null;
  variants: string[];
  created_at: string;
};

export default async function ContentPage({
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
    .select("id, name, status")
    .eq("id", brandId)
    .single();
  if (!brand) notFound();

  const { data: outputs } = await supabase
    .from("content_outputs")
    .select("id, type, prompt, audience, variants, created_at")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  const t = await getServerT();
  const history: ContentRow[] = (outputs ?? []).map((r) => ({
    id: r.id as string,
    type: r.type as string,
    prompt: r.prompt as string,
    audience: (r.audience as string | null) ?? null,
    variants: (r.variants as string[] | null) ?? [],
    created_at: r.created_at as string,
  }));

  return (
    <div className="mx-auto max-w-5xl w-full px-4 md:px-6 py-8 space-y-8">
      <div>
        <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
          {t("content.nav")} · {brand.name.toUpperCase()}
        </div>
        <h2 className="mt-2 text-2xl md:text-3xl font-bold">{t("content.title")}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("content.subtitle")}</p>
      </div>

      <ContentView brandId={brand.id} history={history} />
    </div>
  );
}
