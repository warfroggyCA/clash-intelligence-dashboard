export default function PlayerLoading() {
  return (
    <div className="space-y-6">
      <div className="h-40 rounded-3xl border border-white/10 bg-white/10 animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-3xl border border-white/10 bg-white/10 animate-pulse" />
        <div className="h-64 rounded-3xl border border-white/10 bg-white/10 animate-pulse" />
      </div>
      <div className="h-96 rounded-3xl border border-white/10 bg-white/10 animate-pulse" />
    </div>
  );
}
