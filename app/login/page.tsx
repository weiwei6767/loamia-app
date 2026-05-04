import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { LoginForm } from "./form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  const t = await getServerT();

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <img src="/logo.png" alt="LOAMIA" className="h-12 w-auto mx-auto" />
          <p className="mt-3 text-sm text-[var(--muted)]">{t("auth.subtitle")}</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
