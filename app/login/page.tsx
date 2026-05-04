import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="font-mono text-2xl font-bold tracking-tight text-[var(--accent)]">LOAMIA</div>
          <p className="mt-2 text-sm text-[var(--muted)]">Brand GPT · AI Marketing OS</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
