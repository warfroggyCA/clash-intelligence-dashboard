export default function LoadingWarAnalytics() {
  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-56 rounded bg-white/10" />
          <div className="h-4 w-[520px] max-w-full rounded bg-white/5" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-40 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
        <div className="h-40 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
        <div className="h-40 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
      </div>

      <div className="h-[520px] rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
    </div>
  );
}
