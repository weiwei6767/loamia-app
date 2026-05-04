import { BrandCardSkeleton, Skeleton } from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div>
            <Skeleton className="h-5 w-20" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-32" />
        </div>
        <Skeleton className="h-11 w-full max-w-md mb-8" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <BrandCardSkeleton />
          <BrandCardSkeleton />
          <BrandCardSkeleton />
        </div>
      </section>
    </main>
  );
}
