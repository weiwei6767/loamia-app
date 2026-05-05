"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateKolBrief, type KolForBrief } from "@/lib/ai/kol";

export type KolState = undefined | { error: string } | { success: true; id?: string };

const VALID_PLATFORMS = [
  "threads",
  "instagram",
  "youtube",
  "tiktok",
  "facebook",
  "x",
  "other",
];
const VALID_STATUS = [
  "researching",
  "contacted",
  "in_progress",
  "completed",
  "paused",
  "rejected",
];

function parseKolForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 200);
  const handle = String(formData.get("handle") ?? "").trim().slice(0, 100) || null;
  const platformRaw = String(formData.get("platform") ?? "").trim();
  const platform = VALID_PLATFORMS.includes(platformRaw) ? platformRaw : null;
  const profile_url = String(formData.get("profile_url") ?? "").trim().slice(0, 500) || null;
  const followersRaw = String(formData.get("followers") ?? "").trim();
  const followers = followersRaw ? parseInt(followersRaw, 10) : null;
  const niche = String(formData.get("niche_tags") ?? "").trim();
  const niche_tags = niche
    ? niche.split(/[,，、\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 15)
    : null;
  const contact_email = String(formData.get("contact_email") ?? "").trim().slice(0, 200) || null;
  const contact_phone = String(formData.get("contact_phone") ?? "").trim().slice(0, 50) || null;
  const rate_note = String(formData.get("rate_note") ?? "").trim().slice(0, 500) || null;
  const statusRaw = String(formData.get("status") ?? "researching");
  const status = VALID_STATUS.includes(statusRaw) ? statusRaw : "researching";
  const campaign_name = String(formData.get("campaign_name") ?? "").trim().slice(0, 200) || null;
  const rate_paid = String(formData.get("rate_paid") ?? "").trim().slice(0, 100) || null;
  const collab_notes = String(formData.get("collab_notes") ?? "").trim().slice(0, 4000) || null;

  return {
    name,
    handle,
    platform,
    profile_url,
    followers: followers && !Number.isNaN(followers) ? followers : null,
    niche_tags,
    contact_email,
    contact_phone,
    rate_note,
    status,
    campaign_name,
    rate_paid,
    collab_notes,
  };
}

export async function createKol(_state: KolState, formData: FormData): Promise<KolState> {
  const brandId = String(formData.get("brandId") ?? "");
  if (!brandId) return { error: "missing brandId" };

  const data = parseKolForm(formData);
  if (!data.name) return { error: "請輸入 KOL 名稱" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { data: brand } = await supabase
    .from("brands")
    .select("id, agency_id")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在" };

  const { data: row, error } = await supabase
    .from("brand_kols")
    .insert({
      agency_id: brand.agency_id,
      brand_id: brand.id,
      user_id: user.id,
      ...data,
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "建立失敗" };

  revalidatePath(`/brand/${brandId}/kol`);
  return { success: true, id: row.id as string };
}

export async function updateKol(_state: KolState, formData: FormData): Promise<KolState> {
  const id = String(formData.get("id") ?? "");
  const brandId = String(formData.get("brandId") ?? "");
  if (!id || !brandId) return { error: "missing fields" };

  const data = parseKolForm(formData);
  if (!data.name) return { error: "請輸入 KOL 名稱" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_kols")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/brand/${brandId}/kol`);
  return { success: true };
}

export async function deleteKol(id: string, brandId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("brand_kols").delete().eq("id", id);
  revalidatePath(`/brand/${brandId}/kol`);
}

export async function updateKolStatus(
  id: string,
  brandId: string,
  status: string
): Promise<void> {
  if (!VALID_STATUS.includes(status)) return;
  const supabase = await createClient();
  await supabase
    .from("brand_kols")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath(`/brand/${brandId}/kol`);
}

export type GenerateBriefState =
  | undefined
  | { error: string }
  | { success: true; brief: string };

export async function generateBrief(
  _state: GenerateBriefState,
  formData: FormData
): Promise<GenerateBriefState> {
  const id = String(formData.get("id") ?? "");
  const brandId = String(formData.get("brandId") ?? "");
  if (!id || !brandId) return { error: "missing fields" };

  const supabase = await createClient();
  const { data: kol } = await supabase
    .from("brand_kols")
    .select("name, handle, platform, followers, niche_tags, rate_note, campaign_name")
    .eq("id", id)
    .single();
  if (!kol) return { error: "找不到 KOL 資料" };

  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "品牌不存在" };

  const kolForBrief: KolForBrief = {
    name: kol.name as string,
    handle: (kol.handle as string | null) ?? null,
    platform: (kol.platform as string | null) ?? null,
    followers: (kol.followers as number | null) ?? null,
    niche_tags: (kol.niche_tags as string[] | null) ?? null,
    rate_note: (kol.rate_note as string | null) ?? null,
    campaign_name: (kol.campaign_name as string | null) ?? null,
  };

  let brief: string;
  try {
    brief = await generateKolBrief(supabase, brandId, brand.name as string, kolForBrief);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "生成失敗" };
  }

  // Save the brief to the row
  await supabase
    .from("brand_kols")
    .update({ brief, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(`/brand/${brandId}/kol`);
  return { success: true, brief };
}
