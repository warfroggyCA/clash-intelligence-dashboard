"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from '@/lib/utils';

interface SectionProps {
  id: string;
  title: string;
  icon?: string;
  children: ReactNode;
}

const Section = ({ id, title, icon = "", children }: SectionProps) => (
  <section id={id} className="space-y-4 rounded-2xl bg-slate-900/60 p-6 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.55)] backdrop-blur">
    <h3 className="text-xl font-semibold tracking-tight text-slate-50">
      {icon && <span className="mr-2 text-2xl align-middle">{icon}</span>}
      {title}
    </h3>
    <div className="space-y-4 text-sm leading-relaxed text-slate-300">
      {children}
    </div>
  </section>
);

interface CardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

const Card = ({ title, children, className = "" }: CardProps) => (
  <div className={cn("rounded-xl border border-white/10 bg-slate-900/40 p-4", className)}>
    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 mb-3">{title}</h4>
    <div className="space-y-2 text-sm text-slate-200">
      {children}
    </div>
  </div>
);

interface FAQSectionsProps {
  className?: string;
}

const FAQSections: React.FC<FAQSectionsProps> = ({ className }) => {
  const aceExample = useAceExampleData();

  return (
    <div className={cn("space-y-8", className)}>
      <Section id="overview" title="What is the Clash Intelligence dashboard?" icon="📊">
        <p>
          Clash Intelligence is our end-to-end leadership console. It pulls snapshots, war history, capital data, and donation ledgers into a single place so leaders can monitor the clan with zero manual spreadsheets.
        </p>
        <Card title="Why it matters">
          <ul className="list-disc list-inside space-y-1">
            <li>360° roster view: activity, tenure, donations, war readiness.</li>
            <li>ACE score crowns true top performers (balanced offense, defense, reliability, service).</li>
            <li>Leadership workflows: departure manager, quick actions, smart insights, Discord publishing, applicant scoring.</li>
          </ul>
        </Card>
      </Section>

      <Section id="modules" title="Dashboard modules" icon="🧭">
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Roster snapshot">
            <ul className="space-y-1">
              <li>Current clan composition, average TH, trophy pulls, donation totals.</li>
              <li>ACE leader highlight (tap to view full leaderboard + math breakdown).</li>
              <li>Smart insights reel (AI-generated headlines from stored change logs).</li>
            </ul>
          </Card>
          <Card title="Changes & history">
            <ul className="space-y-1">
              <li>Roster change log (joins, leaves, promotions, rush deltas).</li>
              <li>AI change summaries stored in Supabase (with read/action tracking).</li>
              <li>Export-ready copy for Discord or clan mail.</li>
            </ul>
          </Card>
          <Card title="Coaching & DNA">
            <ul className="space-y-1">
              <li>Smart coaching cards: prioritized tasks for each member.</li>
              <li>Player DNA profiles: archetypes, strengths, rush breakdown.</li>
              <li>Capital & donation context to reinforce clan culture.</li>
            </ul>
          </Card>
          <Card title="Operations">
            <ul className="space-y-1">
              <li>Quick actions toolbar (refresh data, create intel posts, open modals).</li>
              <li>Departure manager, ingestion monitor, role impersonation.</li>
              <li>Settings modal for clan roster, data sources, leadership access.</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section id="ace" title="ACE score explained" icon="🥇">
        <p>
          ACE (All-Mode Clan Excellence) blends five normalized components with shrinkage + recency controls. Dive deeper in <Link href="/docs/ace_score_spec.md" className="text-brand-primary hover:underline">ace_score_spec.md</Link> or jump straight to the <Link href="/docs/ace_score_spec.md#components-in-detail" className="text-brand-primary hover:underline">component breakdown</Link>.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Component weights">
            <ul className="space-y-1">
              <li><strong>OAE</strong> (40%): off the expected-star curve per attack, TH neutral, cleanup bonus.</li>
              <li><strong>DAE</strong> (15%): defensive holds vs. expected stars conceded.</li>
              <li><strong>PR</strong> (20%): war/capital usage streak (0.55/0.30/0.15 blend).</li>
              <li><strong>CAP</strong> (15%): VPA efficiency + finisher rate + one-hit rate.</li>
              <li><strong>DON</strong> (10%): robust z(balance) + 0.5×z(ratio) with ±2.5 clamp.</li>
            </ul>
          </Card>
          <Card title="Scoring pipeline">
            <ol className="list-decimal list-inside space-y-1">
              <li>Component z-scores fetched from `member_snapshot_stats.extras.ace` (fallback = live calc).</li>
              <li>Shrinkage applied (k=6 attacks / 4 defenses / 8 capital).</li>
              <li>Weighted sum → logistic σ(1.10) keeps core in 0–1 band.</li>
              <li>Availability multiplier (0.85–1.00) rewards consistent play.</li>
              <li>Result ×100 → stored ACE; breakdown visible on hover.</li>
            </ol>
          </Card>
          <Card title="Interactive tooling" className="md:col-span-2">
            <ul className="space-y-1">
              <li><Link href="/" className="text-brand-primary hover:underline">Roster dashboard</Link> → click the ACE leader tile for the live breakdown modal.</li>
              <li><Link href="/docs/ace_score_spec.md#pseudocode-concise" className="text-brand-primary hover:underline">Pseudocode exhibit</Link> shows the exact loop each component runs.</li>
              <li><Link href="/docs/architecture/data-spine" className="text-brand-primary hover:underline">Data spine guide</Link> covers where the `extras.ace` payload is persisted in Supabase.</li>
            </ul>
          </Card>
        </div>
        <Card title="Worked example: latest live leader" className="md:col-span-2">
          <AceExampleCard state={aceExample} />
        </Card>
        <Card title="What-if scenarios" className="md:col-span-2">
          <AceScenarioCard state={aceExample} />
        </Card>
      </Section>

      <Section id="data" title="Data sources" icon="🗂️">
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Supabase tables">
            <ul className="space-y-1">
              <li><code>roster_snapshots</code>: clan snapshot metadata.</li>
              <li><code>member_snapshot_stats</code>: per-member metrics + `extras.ace` payload.</li>
              <li><code>batch_ai_results</code>: smart insights & coaching bundles.</li>
              <li><code>clan_snapshots</code>, <code>snapshots</code>: legacy snapshot storage.</li>
            </ul>
          </Card>
          <Card title="Local fallbacks">
            <ul className="space-y-1">
              <li><code>/out/full-snapshots</code>: generated from ingestion pipeline for local dev.</li>
              <li><code>/data/members.json</code>: quick-start roster for offline demos.</li>
              <li>Config toggles: `cfg.useLocalData` vs `cfg.useSupabase` (see <code>src/lib/config.ts</code>).</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section id="tooling" title="Tooling & workflows" icon="🛠️">
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Ingestion">
            <ul className="space-y-1">
              <li><code>scripts/setup-cron.sh</code> + <code>CRON_SETUP.md</code> configure scheduled pulls.</li>
              <li>Job persistence handled in <code>src/lib/ingestion/persist-roster.ts</code>.</li>
              <li>CLI ingestion writes to Supabase and `out/full-snapshots` for regression.</li>
            </ul>
          </Card>
          <Card title="Testing & quality">
            <ul className="space-y-1">
              <li>Jest: `npm test -- ace-score` validates scoring pipeline.</li>
              <li>Storybook (planned) for UI states, especially ACE tooltips.</li>
              <li>ESLint temporarily disabled during build; run locally for linting.</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section id="faq" title="Quick answers" icon="💬">
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Why is ACE 48.8 in dummy data?">
            <p>
              Without historical component values, the weighted core = 0 → logistic(0)=0.5 → 0.5×0.98 availability → 48.8. Once `extras.ace` is populated from ingestion, each component shows real contributions.
            </p>
          </Card>
          <Card title="Image domains error?">
            <p>
              Next/Image requires whitelisting remote hosts. We added <code>cdn-assets-eu.frontify.com</code> & <code>api-assets.clashofclans.com</code> to <code>next.config.mjs</code>. Restart dev server after editing.</p>
          </Card>
          <Card title="Where do I edit ACE logic?">
            <p>
              Core logic: <code>src/lib/ace-score.ts</code>. UI breakdown: <code>src/components/roster/AceLeaderboardCard.tsx</code>. Stored values live in Supabase (<code>member_snapshot_stats.extras.ace</code>).</p>
          </Card>
          <Card title="How do I refresh data?">
            <p>
              Use the quick actions toolbar “Refresh” button (calls <code>refreshData()</code> in dashboard store). For ingestion, run the CLI or cron job to generate new snapshots and ACE extras.</p>
          </Card>
        </div>
      </Section>

      <Section id="support" title="Need help?" icon="☎️">
        <ul className="space-y-2">
          <li>Check <Link href="/docs/architecture/data-spine" className="text-brand-primary hover:underline">data spine docs</Link> for pipeline details.</li>
          <li>Review <code>SUPABASE_SETUP.md</code> & <code>DEPLOYMENT.md</code> for environment configuration.</li>
          <li>Ping @warfroggy in Discord for production incidents.</li>
        </ul>
      </Section>
    </div>
  );
};

interface AceExampleResponse {
  success: boolean;
  roster?: {
    clan?: string | null;
    clanTag?: string | null;
    fetchedAt?: string | null;
    memberCount: number;
    snapshotFile?: string;
  };
  player?: {
    tag: string;
    name: string;
    townHallLevel?: number | null;
    role?: string | null;
    ace: number;
    availability: number;
    highlight?: string | null;
  };
  breakdown?: Array<{
    code: string;
    name: string;
    weight: number;
    value: number;
    weighted: number;
  }>;
  core?: number;
  logistic?: number;
  logisticAlpha?: number;
  error?: string;
}

interface AceExampleState {
  loading: boolean;
  error: string | null;
  data: AceExampleData | null;
}

interface AceExampleData {
  roster: {
    clan?: string | null;
    clanTag?: string | null;
    fetchedAt?: string | null;
    memberCount: number;
    snapshotFile?: string;
  };
  player: {
    tag: string;
    name: string;
    townHallLevel?: number | null;
    role?: string | null;
    ace: number;
    availability: number;
    highlight?: string | null;
  };
  breakdown: Array<{
    code: string;
    name: string;
    weight: number;
    value: number;
    weighted: number;
  }>;
  core: number;
  logistic: number;
  logisticAlpha: number;
}

function useAceExampleData(): AceExampleState {
  const [state, setState] = useState<AceExampleState>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/faq/ace-example');
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        const json: AceExampleResponse = await res.json();
        if (!json.success || !json.player || !json.breakdown || json.core === undefined || json.logistic === undefined || json.logisticAlpha === undefined || !json.roster) {
          throw new Error(json.error || 'Incomplete example payload');
        }

        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            data: {
              roster: json.roster,
              player: json.player,
              breakdown: json.breakdown,
              core: json.core,
              logistic: json.logistic,
              logisticAlpha: json.logisticAlpha,
            },
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: null,
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

interface AceExampleCardProps {
  state: AceExampleState;
}

const AceExampleCard: React.FC<AceExampleCardProps> = ({ state }) => {
  if (state.loading) {
    return <p className="text-sm text-slate-400">Loading latest clan numbers…</p>;
  }

  if (state.error || !state.data) {
    return (
      <div className="space-y-2 text-sm text-slate-400">
        <p>Unable to load a live example right now.</p>
        {state.error && <p className="text-xs text-rose-300/80">{state.error}</p>}
        <p>Check that the ingestion pipeline has generated a recent snapshot in <code>/out/full-snapshots</code>.</p>
      </div>
    );
  }

  const { player, roster, breakdown, logisticAlpha } = state.data;
  const snapshotDate = roster.fetchedAt ? formatSnapshot(roster.fetchedAt) : roster.snapshotFile;
  const townHallLabel = player.townHallLevel ? `TH${player.townHallLevel}` : 'Unknown TH';
  const availabilityPercent = Math.round(player.availability * 100);

  return (
    <div className="space-y-4 text-sm text-slate-300">
      <div className="space-y-1">
        <p>
          Latest snapshot {snapshotDate ? `(${snapshotDate})` : ''} crowns <strong>{player.name}</strong>{' '}
          {player.townHallLevel ? `(${townHallLabel})` : ''} as ACE leader with <strong>{player.ace.toFixed(1)}</strong>.
          {player.highlight ? ` ${player.highlight}.` : ''}
        </p>
        <p className="text-xs text-slate-400">
          Snapshot file: {roster.snapshotFile ?? 'n/a'} • Members: {roster.memberCount}{' '}
          {roster.clan ? `• Clan: ${roster.clan}` : ''}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-white/5 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-4 py-2">Component</th>
              <th className="px-4 py-2">Weight</th>
              <th className="px-4 py-2">Shrunk z</th>
              <th className="px-4 py-2">Weighted</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((component) => (
              <tr key={component.code}>
                <td className="px-4 py-2">{component.code}</td>
                <td className="px-4 py-2">{component.weight.toFixed(2)}</td>
                <td className="px-4 py-2">{component.value.toFixed(2)}</td>
                <td className="px-4 py-2">{component.weighted.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-white/5">
            <tr className="font-semibold text-slate-100">
              <td className="px-4 py-2" colSpan={3}>Core sum</td>
              <td className="px-4 py-2">{state.data.core.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="px-4 py-2" colSpan={3}>Logistic σ({logisticAlpha.toFixed(2)})</td>
              <td className="px-4 py-2">{state.data.logistic.toFixed(3)}</td>
            </tr>
            <tr>
              <td className="px-4 py-2" colSpan={3}>Availability</td>
              <td className="px-4 py-2">{availabilityPercent}%</td>
            </tr>
            <tr className="font-semibold text-brand-primary">
              <td className="px-4 py-2" colSpan={3}>ACE</td>
              <td className="px-4 py-2">{player.ace.toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Tip: hover any ACE score in the roster modal to see these exact numbers pulled live from `member_snapshot_stats.extras.ace`.
      </p>
    </div>
  );
};

interface AceScenarioCardProps {
  state: AceExampleState;
}

interface ScenarioResult {
  components: Array<{
    code: string;
    name: string;
    weight: number;
    baseValue: number;
    scenarioValue: number;
    delta: number;
  }>;
  availability: number;
  logistic: number;
  ace: number;
  deltaAce: number;
  summary: string;
}

interface ScenarioConfig {
  id: string;
  label: string;
  description: string;
  compute: (data: AceExampleData) => ScenarioResult;
}

const logistic = (core: number, alpha: number): number => 1 / (1 + Math.exp(-alpha * core));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const AceScenarioCard: React.FC<AceScenarioCardProps> = ({ state }) => {
  const scenarioConfigs = useMemo<ScenarioConfig[]>(() => [
    {
      id: 'missed-war',
      label: 'Miss a war attack',
      description: 'Skip one war hit this week',
      compute: (data) => {
        const availability = clamp(data.player.availability - 0.08, 0.7, 1);
        const components = data.breakdown.map((component) => {
          const baseValue = component.value;
          const scenarioValue = component.code === 'PR' ? Math.max(-1.5, baseValue - 0.8) : baseValue;
          return {
            code: component.code,
            name: component.name,
            weight: component.weight,
            baseValue,
            scenarioValue,
            delta: scenarioValue - baseValue,
          };
        });
        const core = components.reduce((sum, comp) => sum + comp.weight * comp.scenarioValue, 0);
        const logisticValue = logistic(core, data.logisticAlpha);
        const ace = logisticValue * 100 * availability;
        const deltaAce = ace - data.player.ace;
        const prComponent = components.find((c) => c.code === 'PR');
        const summary = prComponent
          ? `PAR drops from ${prComponent.baseValue.toFixed(2)}σ to ${prComponent.scenarioValue.toFixed(2)}σ; availability ${Math.round(availability * 100)}%.`
          : `Availability ${Math.round(availability * 100)}%.`;
        return { components, availability, logistic: logisticValue, ace, deltaAce, summary };
      },
    },
    {
      id: 'donation-dip',
      label: 'Donation slump',
      description: 'Return donations to clan average',
      compute: (data) => {
        const components = data.breakdown.map((component) => {
          const baseValue = component.value;
          const scenarioValue = component.code === 'DON' ? 0 : baseValue;
          return {
            code: component.code,
            name: component.name,
            weight: component.weight,
            baseValue,
            scenarioValue,
            delta: scenarioValue - baseValue,
          };
        });
        const availability = data.player.availability;
        const core = components.reduce((sum, comp) => sum + comp.weight * comp.scenarioValue, 0);
        const logisticValue = logistic(core, data.logisticAlpha);
        const ace = logisticValue * 100 * availability;
        const deltaAce = ace - data.player.ace;
        const donComponent = components.find((c) => c.code === 'DON');
        const summary = donComponent
          ? `Donation component softens from ${donComponent.baseValue.toFixed(2)}σ to 0σ.`
          : 'Donation impact removed.';
        return { components, availability, logistic: logisticValue, ace, deltaAce, summary };
      },
    },
    {
      id: 'cleanup-streak',
      label: 'Cleanup streak',
      description: 'Add two clutch cleanup triples',
      compute: (data) => {
        const availability = clamp(data.player.availability + 0.02, 0.7, 1.05);
        const components = data.breakdown.map((component) => {
          const baseValue = component.value;
          const scenarioValue = component.code === 'OAE' ? Math.min(baseValue + 0.7, baseValue + 1) : baseValue;
          return {
            code: component.code,
            name: component.name,
            weight: component.weight,
            baseValue,
            scenarioValue,
            delta: scenarioValue - baseValue,
          };
        });
        const core = components.reduce((sum, comp) => sum + comp.weight * comp.scenarioValue, 0);
        const logisticValue = logistic(core, data.logisticAlpha);
        const ace = logisticValue * 100 * availability;
        const deltaAce = ace - data.player.ace;
        const ovaComponent = components.find((c) => c.code === 'OAE');
        const summary = ovaComponent
          ? `OAE rises to ${ovaComponent.scenarioValue.toFixed(2)}σ with availability ${Math.round(availability * 100)}%.`
          : 'Offense boost applied.';
        return { components, availability, logistic: logisticValue, ace, deltaAce, summary };
      },
    },
  ], []);

  const [activeScenario, setActiveScenario] = useState<string | null>(scenarioConfigs[0]?.id ?? null);

  const scenarioResults = useMemo<Record<string, ScenarioResult>>(() => {
    if (!state.data) {
      return {};
    }
    const results: Record<string, ScenarioResult> = {};
    for (const scenario of scenarioConfigs) {
      results[scenario.id] = scenario.compute(state.data);
    }
    return results;
  }, [scenarioConfigs, state.data]);

  if (state.loading) {
    return <p className="text-sm text-slate-400">Loading scenarios…</p>;
  }

  if (state.error || !state.data) {
    return <p className="text-sm text-slate-400">Scenarios unavailable without example data.</p>;
  }

  const active = activeScenario ? scenarioResults[activeScenario] : null;
  const activeConfig = activeScenario ? scenarioConfigs.find((s) => s.id === activeScenario) : null;

  return (
    <div className="space-y-4 text-sm text-slate-300">
      <div className="flex flex-wrap gap-2">
        {scenarioConfigs.map((scenario) => {
          const isActive = scenario.id === activeScenario;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setActiveScenario(scenario.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] transition',
                isActive
                  ? 'border-brand-primary/80 bg-brand-primary/20 text-brand-primary'
                  : 'border-white/10 text-slate-400 hover:border-brand-primary/50 hover:text-slate-100'
              )}
            >
              {scenario.label}
            </button>
          );
        })}
      </div>

      {active && activeConfig ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300">
          <p className="text-slate-200">
            {activeConfig.description}. {active.summary}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">New ACE</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {active.ace.toFixed(1)}{' '}
                <span className={active.deltaAce >= 0 ? 'text-emerald-300 text-sm font-normal' : 'text-rose-300 text-sm font-normal'}>
                  ({active.deltaAce >= 0 ? '+' : ''}{active.deltaAce.toFixed(1)})
                </span>
              </p>
              <p className="text-[11px] text-slate-500">Availability {Math.round(active.availability * 100)}% • Logistic {active.logistic.toFixed(3)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Component shifts</p>
              <ul className="mt-1 space-y-1">
                {active.components
                  .filter((component) => Math.abs(component.delta) > 0.05)
                  .map((component) => (
                    <li key={component.code} className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">{component.code}</span>
                      <span>
                        {component.scenarioValue.toFixed(2)}σ{' '}
                        <span className={component.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                          ({component.delta >= 0 ? '+' : ''}{component.delta.toFixed(2)})
                        </span>
                      </span>
                    </li>
                  ))}
                {active.components.every((component) => Math.abs(component.delta) <= 0.05) && (
                  <li className="text-slate-400">No notable component changes.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Select a scenario to see projected ACE shifts.</p>
      )}
    </div>
  );
};

function formatSnapshot(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

export default FAQSections;
