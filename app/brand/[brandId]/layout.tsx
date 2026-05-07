import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BrandStatusToggle } from "./brand-status-toggle";
import { BrandSidebar } from "./sidebar";
import { MobileSidebarTrigger } from "./mobile-sidebar";
import { ResizableSplit } from "./resizable-split";
import { RightChatPanel } from "./right-chat-panel";

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  const t = await getServerT();

  return (
    <div className="h-screen flex flex-col">
      {/* Top header */}
      <header className="border-b border-[var(--line)] shrink-0">
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <MobileSidebarTrigger brandId={brand.id} />
            <Link
              href="/dashboard"
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
            >
              ←
            </Link>
            <div className="min-w-0">
              <div className="text-[10px] font-mono tracking-widest text-[var(--accent)]">
                {t("brand.label")}
              </div>
              <h1 className="text-sm font-bold truncate">{brand.name}</h1>
            </div>
          </div>
          <BrandStatusToggle
            brandId={brand.id}
            status={brand.status as "active" | "archived"}
          />
        </div>
      </header>

      {/* Body: sidebar + resizable(main + chat) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[180px_1fr] overflow-hidden">
        <aside className="border-r border-[var(--line)] overflow-y-auto bg-[var(--surface)]/40 hidden md:block">
          <BrandSidebar brandId={brand.id} />
        </aside>

        <ResizableSplit
          rightContent={
            <>
              <div className="px-3 py-2 border-b border-[var(--line)] flex items-center gap-2 shrink-0">
                <span className="text-base">🧠</span>
                <span className="font-mono text-[10px] tracking-widest text-[var(--accent)] truncate">
                  BRAND BRAIN · {(brand.name as string).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <RightChatPanel brandId={brand.id} brandName={brand.name as string} />
              </div>
            </>
          }
        >
          {children}
        </ResizableSplit>
      </div>
    </div>
  );
}
