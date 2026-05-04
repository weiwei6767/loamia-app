import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Logged in: figure out where to send them
  const { data: memberships } = await supabase
    .from("agency_members")
    .select("agency_id")
    .limit(1);

  if (!memberships || memberships.length === 0) redirect("/onboarding");
  redirect("/dashboard");
}
