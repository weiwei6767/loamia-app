import { ChatSkeleton, ThreadListSkeleton, DocumentListSkeleton, Skeleton } from "@/components/skeleton";

export default function BrandLoading() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-12" />
            <div>
              <Skeleton className="h-3 w-12" />
              <Skeleton className="mt-2 h-5 w-32" />
            </div>
          </div>
          <Skeleton className="h-7 w-20" />
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_280px_1fr]">
        <aside className="border-r border-[var(--line)] p-5">
          <Skeleton className="h-3 w-16 mb-4" />
          <ThreadListSkeleton />
        </aside>
        <aside className="border-r border-[var(--line)] p-5 space-y-6 xl:block hidden">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-3 w-20 mt-6" />
          <DocumentListSkeleton />
        </aside>
        <section>
          <ChatSkeleton />
        </section>
      </div>
    </main>
  );
}
