import { tokens } from '@/lib/tokens';

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div
    className="rounded-2xl border"
    style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-md)' }}
  >
    <div className="border-b border-white/5 px-4 py-3 text-sm font-semibold text-white/80">{title}</div>
    <div className="p-4 text-slate-200 text-sm">{children}</div>
  </div>
);

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'warning' }) => {
  const toneColor = tone === 'positive' ? tokens.colors.success : tone === 'warning' ? tokens.colors.warning : tokens.colors.text;
  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--panel)', borderColor: 'var(--border-subtle)' }}>
      <div className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className="text-2xl font-semibold" style={{ color: toneColor }}>{value}</div>
    </div>
  );
};

export default function UIShowcasePage() {
  const epicGradient = 'linear-gradient(180deg, #a74ce5 0%, #933fcb 50%, #b04fac 100%)';

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">UI Snapshot</h1>
        <p className="text-slate-300">How the new tokens play together on real surfaces.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div
            className="rounded-3xl border p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(30,41,69,0.9), rgba(20,31,54,0.92))',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Dashboard</div>
            <h2 className="mt-2 text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              Clan Health Overview
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              A focused hero for key KPIs and quick actions.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label="Members" value="19" />
              <Stat label="Snapshot age" value="3h" tone="warning" />
              <Stat label="Engagement" value="92%" tone="positive" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <button
                className="rounded-lg px-4 py-2 font-semibold text-slate-900"
                style={{ background: tokens.colors.accent, boxShadow: 'var(--shadow-neon)' }}
              >
                Run Ingestion
              </button>
              <button
                className="rounded-lg px-4 py-2 font-semibold text-white"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Generate Insights
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Card title="Roster">Dense data tables/cards with consistent radii/padding.</Card>
            <Card title="Leadership">Permissioned tools stay on this darker surface.</Card>
            <Card title="Player DB">Notes, warnings, timeline; uses muted + border tone.</Card>
          </div>
        </div>

        <div className="space-y-3">
          <Card title="Filters">
            <div className="space-y-2">
              <label className="block text-xs text-slate-400">Search</label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm text-white focus:border-[var(--accent-alt)] focus:outline-none"
                style={{
                  background: 'var(--input)',
                  borderColor: 'var(--border-subtle)',
                }}
                placeholder="Search players, tags"
              />
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg border px-3 py-2 text-xs text-slate-200"
                  style={{ background: 'var(--panel)', borderColor: 'var(--border-subtle)' }}
                >
                  Current
                </button>
                <button
                  className="flex-1 rounded-lg border px-3 py-2 text-xs text-slate-200"
                  style={{ background: 'var(--panel)', borderColor: 'var(--border-subtle)' }}
                >
                  Former
                </button>
              </div>
            </div>
          </Card>
          <Card title="Activity">
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Pulse</span>
                <span className="text-emerald-300 font-semibold">High</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: '72%', background: tokens.colors.accentAlt }} />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Leaderboard</span>
                <span>Hover for details →</span>
              </div>
            </div>
          </Card>
          <Card title="Equipment Tiles">
            <div className="flex flex-wrap gap-3 text-xs text-slate-300">
              <div className="flex flex-col items-center gap-1 rounded-xl border p-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                <div className="h-14 w-14 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: 'var(--panel)' }}>
                  <div className="h-full w-full bg-white/5 flex items-center justify-center text-[11px] px-1 text-slate-100">Common</div>
                </div>
                <span className="text-white font-semibold leading-tight">Royal Gem</span>
                <span className="text-[11px] text-slate-400">Common · Max 18</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border p-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                <div className="h-14 w-14 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: epicGradient }}>
                  <div className="h-full w-full bg-white/5 flex items-center justify-center text-[11px] px-1 text-slate-100">Epic</div>
                </div>
                <span className="text-white font-semibold leading-tight">Meteor Staff</span>
                <span className="text-[11px] text-slate-400">Epic · Max 27</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border p-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                <div className="h-14 w-14 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(167,76,229,0.25) 0%, rgba(147,63,203,0.2) 50%, rgba(176,79,172,0.2) 100%)' }}>
                  <div className="h-full w-full flex items-center justify-center text-[11px] px-1 text-slate-100" style={{ filter: 'grayscale(100%) brightness(0.6)', opacity: 0.7 }}>
                    Epic
                  </div>
                </div>
                <span className="text-white font-semibold leading-tight">Henchmen Puppet</span>
                <span className="text-[11px] text-slate-400">Not owned</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card title="Buttons & Chips">
          <div className="flex flex-wrap gap-3 text-sm">
            <button
              className="rounded-lg px-4 py-2 font-semibold text-slate-900"
              style={{ background: tokens.colors.accent, boxShadow: 'var(--shadow-neon)' }}
            >
              Primary (Accent)
            </button>
            <button
              className="rounded-lg px-4 py-2 font-semibold"
              style={{ background: tokens.colors.accentAlt, color: '#0f172a', boxShadow: 'var(--shadow-glass)' }}
            >
              Accent Alt
            </button>
            <button
              className="rounded-lg px-4 py-2 font-semibold"
              style={{ background: tokens.colors.success, color: '#0f172a' }}
            >
              Success
            </button>
            <button
              className="rounded-lg px-4 py-2 font-semibold"
              style={{ background: tokens.colors.warning, color: '#0f172a' }}
            >
              Warning
            </button>
            <button
              className="rounded-lg px-4 py-2 font-semibold text-white"
              style={{ background: tokens.colors.danger }}
            >
              Danger
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full px-3 py-1 border" style={{ borderColor: tokens.colors.border, color: tokens.colors.muted }}>
              Muted chip
            </span>
            <span className="rounded-full px-3 py-1" style={{ background: tokens.colors.accentAlt, color: '#0f172a' }}>
              Accent chip
            </span>
            <span className="rounded-full px-3 py-1" style={{ background: tokens.colors.warning, color: '#0f172a' }}>
              Warning chip
            </span>
          </div>
        </Card>

        <Card title="Statuses">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: tokens.colors.success }} />
              <span className="text-slate-200">Healthy</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: tokens.colors.warning }} />
              <span className="text-slate-200">Needs attention</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: tokens.colors.danger }} />
              <span className="text-slate-200">Critical</span>
            </div>
          </div>
        </Card>

        <Card title="Inputs & Wells">
          <div className="space-y-3 text-sm">
            <label className="block text-xs text-slate-400">Textarea</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2 text-sm text-white focus:border-[var(--accent-alt)] focus:outline-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border-subtle)' }}
              rows={3}
              placeholder="Notes, context, etc."
            />
            <div className="rounded-lg border px-3 py-3" style={{ background: 'var(--surface)', borderColor: 'var(--border-subtle)' }}>
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Surface well</div>
              <div className="text-slate-200">Use for nested panels inside cards.</div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
