import { Skeleton } from "@/components/skeleton";

export default function OnboardLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <Skeleton className="h-3 w-20 mx-auto" />
          <Skeleton className="mt-3 h-9 w-56 mx-auto" />
          <Skeleton className="mt-3 h-4 w-64 mx-auto" />
        </div>
        <div className="border border-[var(--line)] bg-[var(--surface)] p-8 space-y-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </main>
  );
}
