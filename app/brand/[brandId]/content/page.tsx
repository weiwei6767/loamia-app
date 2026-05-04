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
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 md:px-6 py-4 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/dashboard"
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
            >
              {t("brand.back")}
            </Link>
            <div className="min-w-0">
              <div className="text-xs font-mono tracking-widest text-[var(--accent)]">
                {t("brand.label")}
              </div>
              <h1 className="text-lg font-bold truncate">{brand.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1 text-xs font-mono">
              <Link
                href={`/brand/${brand.id}`}
                className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                {t("reports.chat")}
              </Link>
              <Link
                href={`/brand/${brand.id}/data`}
                className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                {t("data.nav")}
              </Link>
              <Link
                href={`/brand/${brand.id}/content`}
                className="px-3 py-1.5 border-b-2 border-[var(--accent)] text-[var(--accent)]"
              >
                {t("content.nav")}
              </Link>
              <Link
                href={`/brand/${brand.id}/reports`}
                className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                {t("reports.nav")}
              </Link>
            </nav>
            <BrandStatusToggle
              brandId={brand.id}
              status={brand.status as "active" | "archived"}
            />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl w-full px-4 md:px-6 py-10 space-y-8">
        <div>
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
            {t("content.nav")} · {brand.name.toUpperCase()}
          </div>
          <h2 className="mt-2 text-2xl md:text-3xl font-bold">{t("content.title")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("content.subtitle")}</p>
        </div>

        <ContentView brandId={brand.id} history={history} />
      </section>
    </main>
  );
}
