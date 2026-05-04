import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { BrandCreate } from "./brand-create";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("agency_members")
    .select("agency_id, role, agencies(id, name)")
    .limit(1);
  if (!memberships || memberships.length === 0) redirect("/onboarding");

  const agency = memberships[0].agencies as unknown as { id: string; name: string };

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, status, created_at")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div>
            <div className="font-mono text-lg font-bold tracking-tight text-[var(--accent)]">LOAMIA</div>
            <div className="text-xs text-[var(--muted)]">{agency.name}</div>
          </div>
          <form action={logout}>
            <button type="submit" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
              登出
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <div className="font-mono text-xs tracking-widest text-[var(--accent)]">BRANDS</div>
            <h1 className="mt-2 text-2xl font-bold">客戶品牌</h1>
          </div>
        </div>

        <BrandCreate />

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brands?.map((b) => (
            <Link
              key={b.id}
              href={`/brand/${b.id}`}
              className="block border border-[var(--line)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent)]/50"
            >
              <div className="font-medium">{b.name}</div>
              <div className="mt-2 text-xs text-[var(--muted)]">
                {b.status === "active" ? "● 活躍" : "○ 封存"}
              </div>
            </Link>
          ))}
          {(!brands || brands.length === 0) && (
            <div className="col-span-full text-sm text-[var(--muted)]">
              還沒有品牌——上方建一個吧。
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
