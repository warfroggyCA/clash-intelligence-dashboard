import { tokens } from '@/lib/tokens';

const swatches = [
  { var: 'bg', label: 'Background' },
  { var: 'panel', label: 'Panel' },
  { var: 'surface', label: 'Surface' },
  { var: 'card', label: 'Card' },
  { var: 'text', label: 'Text' },
  { var: 'muted', label: 'Muted' },
  { var: 'accent', label: 'Accent' },
  { var: 'accent-alt', label: 'Accent Alt' },
  { var: 'success', label: 'Success' },
  { var: 'warning', label: 'Warning' },
  { var: 'danger', label: 'Danger' },
];

export default function FoundationPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Foundations</h1>
        <p className="text-slate-300">Token preview for the rebuilt experience.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Colors</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {swatches.map((swatch) => {
            const cssVar = `--${swatch.var}`;
            return (
              <div key={swatch.var} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="h-16 w-full rounded-lg border border-white/10" style={{ background: `var(${cssVar})` }} />
                <div className="text-sm text-white font-semibold">{swatch.label}</div>
                <div className="text-xs text-slate-400 font-mono break-all">{cssVar}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Radii</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(tokens.radii).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 w-36">
              <div className="h-14 w-full border border-white/10 bg-white/5" style={{ borderRadius: value }} />
              <div className="text-sm text-white font-semibold">{key}</div>
              <div className="text-xs text-slate-400 font-mono">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Spacing</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(tokens.spacing).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 w-40">
              <div className="flex items-center gap-2">
                <div className="h-2 rounded-full bg-white/50" style={{ width: value }} />
                <span className="text-xs text-slate-400">{value}</span>
              </div>
              <div className="text-sm text-white font-semibold">{key}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Typography</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Body</div>
            <div className="text-white" style={{ fontFamily: tokens.font.body }}>Plus Jakarta Sans, system</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Display</div>
            <div className="text-white" style={{ fontFamily: tokens.font.display }}>Clash Display, Plus Jakarta Sans</div>
          </div>
        </div>
      </section>
    </div>
  );
}
