"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardState = { error?: string } | undefined;

export async function createAgency(_state: OnboardState, formData: FormData): Promise<OnboardState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "請輸入代理商名稱" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "未登入" };

  const { error } = await supabase.rpc("create_agency_with_owner", { agency_name: name });
  if (error) return { error: error.message };

  redirect("/dashboard");
}
