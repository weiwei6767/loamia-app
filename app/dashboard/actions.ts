"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BrandState = { error?: string } | undefined;

export async function createBrand(_state: BrandState, formData: FormData): Promise<BrandState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "請輸入品牌名稱" };

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("agency_members")
    .select("agency_id")
    .limit(1);
  const agencyId = memberships?.[0]?.agency_id;
  if (!agencyId) redirect("/onboarding");

  const { data: brand, error } = await supabase
    .from("brands")
    .insert({ name, agency_id: agencyId })
    .select()
    .single();
  if (error || !brand) return { error: error?.message ?? "建立失敗" };

  revalidatePath("/dashboard");
  redirect(`/brand/${brand.id}`);
}
