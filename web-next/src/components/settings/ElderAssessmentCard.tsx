"use client";

import { useCallback, useMemo, useState } from 'react';
import {
  ClipboardCopy,
  RefreshCw,
  Sparkles,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { GlassCard } from '@/components/ui';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { calculatePlayerDNA } from '@/lib/player-dna';
import { evaluateRoster, buildReportLine } from '@/lib/elder/evaluator';
import { parseCsv } from '@/lib/elder/rawInputs';
import type { ElderMetricInputs, ElderRecommendation } from '@/lib/elder/types';

const CSV_TEMPLATE = `name,playerTag,tenure_days,consistency,generosity,performance,role,is_elder,prev_score
Player One,#AAAAAAA,180,82,75,68,member,false,
Player Two,#BBBBBBB,420,91,88,77,elder,true,73`;

const BAND_LABELS: Record<ElderRecommendation['band'], string> = {
  promote: 'Promote / Keep',
  monitor: 'Monitor',
  risk: 'At Risk',
  ineligible: 'Ineligible',
};

const BAND_CLASSNAME: Record<ElderRecommendation['band'], string> = {
  promote: 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100',
  monitor: 'border-amber-400/60 bg-amber-500/10 text-amber-100',
  risk: 'border-rose-400/60 bg-rose-500/10 text-rose-100',
  ineligible: 'border-slate-400/60 bg-slate-500/10 text-slate-200',
};

type SummaryCounts = Record<ElderRecommendation['band'], number>;

const formatScore = (score: number) => score.toFixed(1);

const detectRoleIsElder = (role?: string | null): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return normalized === 'elder' || normalized === 'admin';
};

const safeNumber = (value: number | undefined | null): number => {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return value;
};

export function ElderAssessmentCard() {
  const roster = useDashboardStore((state) => state.roster);
  const [csvInput, setCsvInput] = useState('');
  const [results, setResults] = useState<ElderRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<string>('');
  const [lastGenerated, setLastGenerated] = useState<number | null>(null);

  const summary = useMemo<SummaryCounts>(() => {
    const base: SummaryCounts = {
      promote: 0,
      monitor: 0,
      risk: 0,
      ineligible: 0,
    };
    for (const rec of results) {
      base[rec.band] += 1;
    }
    return base;
  }, [results]);

  const handleEvaluate = useCallback((inputs: ElderMetricInputs[]) => {
    if (!inputs.length) {
      setError('Provide at least one member to evaluate.');
      return;
    }
    setIsProcessing(true);
    try {
      const recs = evaluateRoster(inputs).sort((a, b) => b.score - a.score);
      setResults(recs);
      setReport(recs.map((rec) => buildReportLine(rec)).join('\n\n'));
      setLastGenerated(Date.now());
      setError(null);
    } catch (err) {
      console.error('[ElderAssessment] Failed to evaluate roster', err);
      setError('Failed to evaluate roster. Check the input data and try again.');
      setResults([]);
      setReport('');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleEvaluateCsv = useCallback(() => {
    if (!csvInput.trim()) {
      setError('Paste CSV data or use the roster importer.');
      return;
    }
    try {
      const parsed = parseCsv(csvInput);
      handleEvaluate(parsed);
    } catch (err) {
      console.error('[ElderAssessment] CSV parse error', err);
      setError('Could not parse CSV. Ensure headers match the template.');
    }
  }, [csvInput, handleEvaluate]);

  const handleLoadTemplate = () => {
    setCsvInput(CSV_TEMPLATE);
    setError(null);
    setResults([]);
    setReport('');
    setLastGenerated(null);
  };

  const handleFromRoster = useCallback(() => {
    const members = roster?.members ?? [];
    if (!members.length) {
      setError('Load a clan roster first to evaluate from roster data.');
      return;
    }

    const totalMembers = members.length || 1;
    const context = {
      averageDonations: members.reduce((sum, member) => sum + safeNumber(member.donations), 0) / totalMembers,
      averageWarStars: members.reduce((sum, member) => sum + safeNumber(member.warStars), 0) / totalMembers,
      averageCapitalContributions:
        members.reduce((sum, member) => sum + safeNumber(member.clanCapitalContributions), 0) / totalMembers,
      totalMembers,
    };

    const inputs: ElderMetricInputs[] = members.map((member) => {
      const tenure = safeNumber(member.tenure ?? member.tenure_days);
      const dna = calculatePlayerDNA(
        {
          name: member.name,
          tag: member.tag,
          donations: safeNumber(member.donations),
          donationsReceived: safeNumber(member.donationsReceived),
          warStars: safeNumber(member.warStars),
          clanCapitalContributions: safeNumber(member.clanCapitalContributions),
          trophies: safeNumber(member.trophies),
          tenure,
          role: member.role,
        },
        context,
      );

      return {
        name: member.name,
        playerTag: member.tag,
        tenureDays: tenure,
        role: member.role || undefined,
        consistency: dna.consistency,
        generosity: dna.generosity,
        performance: dna.performance,
        isElder: detectRoleIsElder(member.role),
        previousScore: null,
      } satisfies ElderMetricInputs;
    });

    handleEvaluate(inputs);
  }, [roster, handleEvaluate]);

  const handleCopyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard?.writeText?.(report);
      setError(null);
    } catch (err) {
      console.error('[ElderAssessment] clipboard write failed', err);
      setError('Unable to copy report to clipboard.');
    }
  };

  const clearResults = () => {
    setResults([]);
    setError(null);
    setReport('');
    setLastGenerated(null);
  };

  return (
    <GlassCard
      id="elder-assessment"
      icon={<Sparkles className="h-5 w-5" aria-hidden />}
      title="Elder readiness assessment"
      subtitle="One-time scoring model to understand who qualifies for Elder status right now."
      className="space-y-6"
    >
      <div className="space-y-3 text-sm text-slate-200">
        <p>
          Feed in leadership metrics (consistency, generosity, performance) to calculate Elder Readiness Scores.
          Start with a CSV export or generate metrics from the roster currently loaded in the dashboard.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          <button
            type="button"
            onClick={handleLoadTemplate}
            className="inline-flex items-center gap-2 rounded-md border border-slate-500/60 px-3 py-1.5 font-semibold transition hover:bg-slate-700/40"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Load CSV template
          </button>
          <button
            type="button"
            onClick={handleFromRoster}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-500/50 px-3 py-1.5 font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Build from current roster
          </button>
          <button
            type="button"
            onClick={clearResults}
            className="inline-flex items-center gap-2 rounded-md border border-slate-600/60 px-3 py-1.5 font-semibold text-slate-200 transition hover:bg-slate-700/40"
          >
            Clear results
          </button>
        </div>
        <textarea
          value={csvInput}
          onChange={(event) => setCsvInput(event.target.value)}
          rows={6}
          placeholder="name,playerTag,tenure_days,consistency,generosity,performance,is_elder,prev_score"
          className="w-full rounded-lg border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <button
            type="button"
            onClick={handleEvaluateCsv}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />} 
            Evaluate CSV
          </button>
          <span className="text-[11px] text-slate-500">
            Headers required: name, playerTag, tenure_days, consistency, generosity, performance, role, is_elder, prev_score
          </span>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Generated {lastGenerated ? new Date(lastGenerated).toLocaleString() : 'just now'}
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
              <span className="rounded-full border border-emerald-400/50 px-2 py-1 text-emerald-100">
                Promote: {summary.promote}
              </span>
              <span className="rounded-full border border-amber-400/50 px-2 py-1 text-amber-100">
                Monitor: {summary.monitor}
              </span>
              <span className="rounded-full border border-rose-400/50 px-2 py-1 text-rose-100">
                Risk: {summary.risk}
              </span>
              <span className="rounded-full border border-slate-500/50 px-2 py-1 text-slate-200">
                Ineligible: {summary.ineligible}
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-brand-border/60 bg-brand-surfaceRaised/40">
            <div className="max-h-[360px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-700/60 text-sm">
                <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Member</th>
                    <th className="px-4 py-3 text-left">Tenure</th>
                    <th className="px-4 py-3 text-left">Consistency</th>
                    <th className="px-4 py-3 text-left">Generosity</th>
                    <th className="px-4 py-3 text-left">Performance</th>
                    <th className="px-4 py-3 text-left">Score</th>
                    <th className="px-4 py-3 text-left">Band</th>
                    <th className="px-4 py-3 text-left">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {results.map((rec) => (
                    <tr key={rec.playerTag} className="hover:bg-slate-900/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100">{rec.name}</div>
                        <div className="text-[11px] font-mono uppercase text-slate-500">{rec.playerTag}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-200">{rec.tenureDays} days</td>
                      <td className="px-4 py-3 text-slate-200">{rec.consistency}</td>
                      <td className="px-4 py-3 text-slate-200">{rec.generosity}</td>
                      <td className="px-4 py-3 text-slate-200">{rec.performance}</td>
                      <td className="px-4 py-3 text-slate-100">{formatScore(rec.score)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${BAND_CLASSNAME[rec.band]}`}>
                          {BAND_LABELS[rec.band]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        <div>{rec.recommendation}</div>
                        {rec.failingDimensions.length > 0 && (
                          <div className="mt-1 text-[11px] text-rose-200">
                            {rec.failingDimensions.join(', ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyReport}
              className="inline-flex items-center gap-2 rounded-md border border-slate-500/60 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800/40"
            >
              <ClipboardCopy className="h-4 w-4" aria-hidden />
              Copy report summary
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

export default ElderAssessmentCard;
