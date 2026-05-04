export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--surface-2)] ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.6s infinite",
      }}
    />
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-20 w-2/3 ml-auto" />
      <Skeleton className="h-24 w-3/4" />
      <Skeleton className="h-16 w-1/2 ml-auto" />
    </div>
  );
}

export function ThreadListSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-3/4" />
    </div>
  );
}

export function DocumentListSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

export function BrandCardSkeleton() {
  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] p-5">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="mt-3 h-3 w-1/3" />
    </div>
  );
}
