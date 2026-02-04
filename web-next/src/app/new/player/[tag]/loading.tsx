export default function LoadingPlayerProfile() {
  return (
    <div className="p-6 space-y-6">
      <div className="animate-pulse space-y-3">
        <div className="h-8 w-64 rounded bg-white/10" />
        <div className="h-4 w-80 rounded bg-white/5" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-40 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
        <div className="h-40 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
        <div className="h-40 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
      </div>

      <div className="h-[420px] rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
    </div>
  );
}
