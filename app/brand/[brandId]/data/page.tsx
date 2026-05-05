import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BrandStatusToggle } from "../brand-status-toggle";
import { DataView } from "./data-view";

type Doc = {
  id: string;
  filename: string;
  status: string;
  byte_size: number | null;
  created_at: string;
  error_message: string | null;
  tags: string[] | null;
};

export default async function DataPage({
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

  const { data: documents } = await supabase
    .from("documents")
    .select("id, filename, status, byte_size, created_at, error_message, tags")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  const t = await getServerT();
  const docs: Doc[] = (documents ?? []) as Doc[];

  return (
    <div className="mx-auto max-w-5xl w-full px-4 md:px-6 py-8">
        <div className="mb-8">
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">
            {t("data.nav")} · {brand.name.toUpperCase()}
          </div>
          <h2 className="mt-2 text-2xl md:text-3xl font-bold">{t("data.title")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("data.subtitle")}</p>
        </div>

        <DataView brandId={brand.id} documents={docs} />
    </div>
  );
}
