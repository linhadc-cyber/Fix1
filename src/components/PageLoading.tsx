export function PageLoading({ label = "Đang tải…" }: { label?: string }) {
  return (
    <div className="animate-rise space-y-3 py-8" aria-busy="true" aria-live="polite">
      <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      <div className="h-8 w-2/3 max-w-md rounded-lg bg-[var(--bg-soft)]" />
      <div className="h-4 w-full max-w-xl rounded bg-[var(--bg-soft)]" />
      <div className="h-4 w-5/6 max-w-lg rounded bg-[var(--bg-soft)]" />
      <div className="h-40 w-full rounded-xl bg-[var(--bg-soft)]" />
    </div>
  );
}
