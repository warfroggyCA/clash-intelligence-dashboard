"use client";

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ''}`} />
);

const CardSkeleton = () => (
  <div
    className="rounded-2xl border p-4 animate-pulse"
    style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}
  >
    <div className="mb-4 h-5 w-3/4 rounded bg-white/10" />
    <div className="space-y-3">
      <div className="h-4 w-full rounded bg-white/10" />
      <div className="h-4 w-2/3 rounded bg-white/10" />
      <div className="h-4 w-1/2 rounded bg-white/10" />
    </div>
  </div>
);

export function RosterCardsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-40" />
          <SkeletonBlock className="h-4 w-64" />
        </div>
        <div className="flex flex-wrap gap-2">
          <SkeletonBlock className="h-10 w-28" />
          <SkeletonBlock className="h-10 w-32" />
          <SkeletonBlock className="h-10 w-20" />
        </div>
      </div>

      <div className="rounded-2xl border" style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}>
        <div className="border-b border-white/5 px-4 py-3 flex flex-wrap items-center gap-3">
          <SkeletonBlock className="h-10 w-64" />
          <SkeletonBlock className="h-10 w-20" />
          <SkeletonBlock className="h-10 w-20" />
          <SkeletonBlock className="h-10 w-20" />
        </div>
        <div className="grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <CardSkeleton key={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}
