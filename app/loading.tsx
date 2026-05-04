export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="spinner" />
        <span className="text-xs font-mono tracking-widest text-[var(--muted)]">LOADING</span>
      </div>
    </main>
  );
}
