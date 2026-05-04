import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardForm } from "./form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("agency_members")
    .select("agency_id")
    .limit(1);
  if (memberships && memberships.length > 0) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="font-mono text-xs tracking-widest text-[var(--accent)]">STEP 01 ──</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">建立你的代理商</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            這是你的工作空間，所有客戶品牌會放在這個代理商之下。
          </p>
        </div>
        <OnboardForm />
      </div>
    </main>
  );
}
