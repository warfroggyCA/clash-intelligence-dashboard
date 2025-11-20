"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ClipboardCopy,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Info,
} from 'lucide-react';
import { GlassCard } from '@/components/ui';
import { calculatePlayerDNA } from '@/lib/player-dna';
import { evaluateRoster, buildReportLine } from '@/lib/elder/evaluator';
import type { ElderMetricInputs, ElderRecommendation } from '@/lib/elder/types';
import { rosterFetcher } from '@/lib/api/swr-fetcher';
import useSWR from 'swr';
import type { RosterData } from '@/app/(dashboard)/simple-roster/roster-transform';
import { showToast } from '@/lib/toast';

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

interface CriteriaSettings {
  promotionThreshold: number;
  monitorThreshold: number;
  consecutiveThreshold: number;
  tenureMinimum: number;
  failingDimensionThreshold: number;
  weightConsistency: number;
  weightGenerosity: number;
  weightPerformance: number;
}

const DEFAULT_CRITERIA: CriteriaSettings = {
  promotionThreshold: 70,
  monitorThreshold: 55,
  consecutiveThreshold: 55,
  tenureMinimum: 90,
  failingDimensionThreshold: 40,
  weightConsistency: 40,
  weightGenerosity: 35,
  weightPerformance: 25,
};

export function ElderAssessmentCard() {
  // Simple Architecture: Fetch roster directly from API (no Zustand)
  const { data: roster, isLoading: isLoadingRoster } = useSWR<RosterData>(
    '/api/v2/roster',
    rosterFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const [results, setResults] = useState<ElderRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<string>('');
  const [lastGenerated, setLastGenerated] = useState<number | null>(null);
  const [showCriteriaSettings, setShowCriteriaSettings] = useState(true);
  const [hasAutoEvaluated, setHasAutoEvaluated] = useState(false);

  // Load criteria from localStorage or use defaults
  const [criteria, setCriteria] = useState<CriteriaSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_CRITERIA;
    try {
      const saved = localStorage.getItem('elder-assessment-criteria');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CRITERIA, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load saved criteria:', e);
    }
    return DEFAULT_CRITERIA;
  });

  // Save criteria to localStorage whenever it changes
  const updateCriteria = useCallback((updates: Partial<CriteriaSettings>) => {
    setCriteria((prev) => {
      const updated = { ...prev, ...updates };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('elder-assessment-criteria', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save criteria:', e);
        }
      }
      return updated;
    });
  }, []);

  // Store the last evaluation inputs so we can re-evaluate when criteria changes
  const lastEvaluationInputsRef = useRef<ElderMetricInputs[] | null>(null);

  // Re-evaluate results when criteria changes (if we have results)
  useEffect(() => {
    if (!lastEvaluationInputsRef.current || lastEvaluationInputsRef.current.length === 0) {
      return; // No previous evaluation to re-run
    }

    // Re-evaluate with new criteria using the last inputs
    try {
      const newResults = evaluateRoster(lastEvaluationInputsRef.current, {
        promotionThreshold: criteria.promotionThreshold,
        monitorThreshold: criteria.monitorThreshold,
        consecutiveThreshold: criteria.consecutiveThreshold,
        tenureMinimum: criteria.tenureMinimum,
        failingDimensionThreshold: criteria.failingDimensionThreshold,
        weights: {
          consistency: criteria.weightConsistency / 100,
          generosity: criteria.weightGenerosity / 100,
          performance: criteria.weightPerformance / 100,
        },
      }).sort((a, b) => b.score - a.score);

      setResults(newResults);
      setReport(newResults.map((rec) => buildReportLine(rec)).join('\n\n'));
    } catch (err) {
      // Ignore errors when re-evaluating
      console.warn('[ElderAssessment] Failed to re-evaluate with new criteria:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    criteria.promotionThreshold,
    criteria.monitorThreshold,
    criteria.consecutiveThreshold,
    criteria.tenureMinimum,
    criteria.failingDimensionThreshold,
    criteria.weightConsistency,
    criteria.weightGenerosity,
    criteria.weightPerformance,
  ]);

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
      // Store inputs for re-evaluation when criteria changes
      lastEvaluationInputsRef.current = inputs;

      const recs = evaluateRoster(inputs, {
        promotionThreshold: criteria.promotionThreshold,
        monitorThreshold: criteria.monitorThreshold,
        consecutiveThreshold: criteria.consecutiveThreshold,
        tenureMinimum: criteria.tenureMinimum,
        failingDimensionThreshold: criteria.failingDimensionThreshold,
        weights: {
          consistency: criteria.weightConsistency / 100,
          generosity: criteria.weightGenerosity / 100,
          performance: criteria.weightPerformance / 100,
        },
      }).sort((a, b) => b.score - a.score);
      setResults(recs);
      setReport(recs.map((rec) => buildReportLine(rec)).join('\n\n'));
      setLastGenerated(Date.now());
      setError(null);
    } catch (err) {
      console.error('[ElderAssessment] Failed to evaluate roster', err);
      setError('Failed to evaluate roster. Check the input data and try again.');
      setResults([]);
      setReport('');
      lastEvaluationInputsRef.current = null;
    } finally {
      setIsProcessing(false);
    }
  }, [criteria]);

  const handleFromRoster = useCallback(() => {
    // Simple Architecture: Use roster from SWR (already fetched)
    const members = roster?.members ?? [];
    if (!members.length) {
      if (isLoadingRoster) {
        setError('Loading roster... Please wait.');
      } else {
        setError('No roster data available. Please ensure you have a clan tag set and the roster page has loaded.');
      }
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
  }, [roster, isLoadingRoster, handleEvaluate]);

  // Auto-evaluate from roster when it loads (only once)
  useEffect(() => {
    if (hasAutoEvaluated || isLoadingRoster || !roster?.members?.length) {
      return; // Already evaluated, still loading, or no roster
    }

    // Auto-evaluate from roster
    setHasAutoEvaluated(true);
    handleFromRoster();
  }, [roster, isLoadingRoster, hasAutoEvaluated, handleFromRoster]);

  // Calculate weight percentages for display (with safety checks)
  const totalWeight = (criteria?.weightConsistency ?? 40) + (criteria?.weightGenerosity ?? 35) + (criteria?.weightPerformance ?? 25);
  const weightConsistencyPct = totalWeight > 0 ? Math.round(((criteria?.weightConsistency ?? 40) / totalWeight) * 100) : 40;
  const weightGenerosityPct = totalWeight > 0 ? Math.round(((criteria?.weightGenerosity ?? 35) / totalWeight) * 100) : 35;
  const weightPerformancePct = totalWeight > 0 ? Math.round(((criteria?.weightPerformance ?? 25) / totalWeight) * 100) : 25;

  const generatePlayerStatusMessage = useCallback((rec: ElderRecommendation): string => {
    const promotionThreshold = criteria.promotionThreshold;
    const monitorThreshold = criteria.monitorThreshold;
    const tenureMinimum = criteria.tenureMinimum;

    // Calculate what they need
    const scoreGap = promotionThreshold - rec.score;
    const daysNeeded = Math.max(0, tenureMinimum - rec.tenureDays);

    // Identify areas that need improvement
    const needsImprovement: string[] = [];
    if (rec.consistency < 60) needsImprovement.push('consistency');
    if (rec.generosity < 60 && weightGenerosityPct >= 5) needsImprovement.push('generosity');
    if (rec.performance < 60) needsImprovement.push('performance');

    // Generate message based on band
    if (rec.band === 'ineligible') {
      return `${rec.name} needs ${daysNeeded} more day${daysNeeded !== 1 ? 's' : ''} in clan to be eligible for Elder promotion.`;
    }

    if (rec.band === 'promote') {
      return `${rec.name} is ready for Elder promotion! Score: ${rec.score.toFixed(1)}/100. Great work! 🎉`;
    }

    if (rec.band === 'monitor') {
      if (rec.score >= promotionThreshold - 5) {
        // Very close (within 5 points)
        const areas = needsImprovement.length > 0
          ? ` Focus on: ${needsImprovement.join(', ')}.`
          : '';
        return `${rec.name} is close to Elder promotion! Score: ${rec.score.toFixed(1)}/100 (needs ${scoreGap.toFixed(1)} more).${areas}`;
      } else {
        // In monitor range but not super close
        const areas = needsImprovement.length > 0
          ? ` Focus on: ${needsImprovement.join(', ')}.`
          : '';
        return `${rec.name} is making progress toward Elder promotion. Score: ${rec.score.toFixed(1)}/100.${areas}`;
      }
    }

    if (rec.band === 'risk') {
      if (rec.failingDimensions.length > 0) {
        const failing = rec.failingDimensions.map(f => f.replace(/ < \d+/, '')).join(', ');
        return `${rec.name} needs improvement in ${failing.toLowerCase()} to be considered for Elder. Current score: ${rec.score.toFixed(1)}/100.`;
      } else {
        const areas = needsImprovement.length > 0
          ? ` Focus on: ${needsImprovement.join(', ')}.`
          : '';
        return `${rec.name} needs improvement to be considered for Elder. Score: ${rec.score.toFixed(1)}/100.${areas}`;
      }
    }

    return `${rec.name} - Elder Readiness Score: ${rec.score.toFixed(1)}/100. ${rec.recommendation}`;
  }, [criteria, weightGenerosityPct]);

  const handleCopyPlayerStatus = useCallback(async (rec: ElderRecommendation) => {
    try {
      const message = generatePlayerStatusMessage(rec);
      await navigator.clipboard?.writeText?.(message);
      setError(null);
      showToast(`Copied status for ${rec.name}`, 'success');
    } catch (err) {
      console.error('[ElderAssessment] Failed to copy player status', err);
      setError('Unable to copy status to clipboard.');
      showToast('Failed to copy status', 'error');
    }
  }, [generatePlayerStatusMessage]);

  const handleCopyReport = async () => {
    if (!report) return;
    try {
      // Build criteria summary
      const criteriaSummary = [
        '=== Elder Assessment Criteria ===',
        `Promotion Threshold: ${criteria.promotionThreshold}`,
        `Monitor Threshold: ${criteria.monitorThreshold}`,
        `Tenure Minimum: ${criteria.tenureMinimum} days`,
        `Failing Dimension Threshold: ${criteria.failingDimensionThreshold}`,
        `Score Weights:`,
        `  - Consistency: ${weightConsistencyPct}%`,
        `  - Generosity: ${weightGenerosityPct}%`,
        `  - Performance: ${weightPerformancePct}%`,
        '',
        '=== Assessment Results ===',
        '',
      ].join('\n');

      const fullReport = criteriaSummary + report;
      await navigator.clipboard?.writeText?.(fullReport);
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
    lastEvaluationInputsRef.current = null;
    setHasAutoEvaluated(false); // Allow re-evaluation after clearing
  };

  const handleResetToDefaults = useCallback(() => {
    // Clear localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('elder-assessment-criteria');
      } catch (e) {
        console.warn('Failed to clear criteria from localStorage:', e);
      }
    }
    // Reset criteria to defaults
    setCriteria(DEFAULT_CRITERIA);
    // Clear any evaluation results
    clearResults();
  }, []);

  return (
    <GlassCard
      id="elder-assessment"
      icon={<Sparkles className="h-5 w-5" aria-hidden />}
      title="Elder readiness assessment"
      subtitle="Customize criteria and see real-time impact on eligibility. Adjust sliders to fine-tune promotion thresholds."
      className="space-y-6"
    >
      {/* Input Section - Always full width */}
      <div className="space-y-3 text-sm text-slate-200">
        <p>
          Calculate Elder Readiness Scores for all members in your current roster. Adjust the criteria settings to customize how members are evaluated.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          <button
            type="button"
            onClick={handleFromRoster}
            disabled={isLoadingRoster || isProcessing}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-500/50 px-3 py-1.5 font-semibold text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingRoster ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                Loading roster...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                Build from current roster
              </>
            )}
          </button>
          {!roster?.members?.length && !isLoadingRoster && (
            <p className="text-xs text-slate-400">
              💡 Tip: Visit the roster page first to load clan data.
            </p>
          )}
          <button
            type="button"
            onClick={clearResults}
            className="inline-flex items-center gap-2 rounded-md border border-slate-600/60 px-3 py-1.5 font-semibold text-slate-200 transition hover:bg-slate-700/40"
          >
            Clear results
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Criteria Settings and Results - Side by side on large screens */}
      {results.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
          {/* Criteria Settings Panel - Left side on large screens */}
          <div className="rounded-lg border border-brand-border/60 bg-brand-surfaceRaised/40 p-4 lg:sticky lg:top-4 lg:h-fit">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-100">Assessment Criteria</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-600/60 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700/60 hover:text-slate-100"
                  title="Reset all criteria to default values"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Reset to Defaults
                </button>
                <button
                  type="button"
                  onClick={() => setShowCriteriaSettings(!showCriteriaSettings)}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showCriteriaSettings ? 'Hide' : 'Show'} Settings
                </button>
              </div>
            </div>

            {showCriteriaSettings && (
              <div className="space-y-4 pt-2 border-t border-brand-border/40">
                {/* Thresholds */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Thresholds</h4>
                    <div className="group relative">
                      <Info className="h-3.5 w-3.5 text-slate-500 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        Score thresholds determine which band (Promote, Monitor, Risk, Ineligible) each candidate falls into based on their Elder Readiness Score.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300">Promotion Threshold</span>
                        <div className="group relative">
                          <Info className="h-3 w-3 text-slate-500 cursor-help" />
                          <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            Minimum Elder Readiness Score required to recommend promotion to Elder status. Scores at or above this threshold are marked as &ldquo;Promote&rdquo;.
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-slate-100">{criteria.promotionThreshold}</span>
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="90"
                      value={criteria.promotionThreshold}
                      onChange={(e) => updateCriteria({ promotionThreshold: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <p className="text-[10px] text-slate-400">Score needed to recommend promotion (default: 70)</p>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300">Monitor Threshold</span>
                        <div className="group relative">
                          <Info className="h-3 w-3 text-slate-500 cursor-help" />
                          <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            Score threshold for the &ldquo;Monitor&rdquo; band. Candidates between Monitor and Promotion thresholds are close but need more observation before promotion.
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-slate-100">{criteria.monitorThreshold}</span>
                    </label>
                    <input
                      type="range"
                      min="40"
                      max="75"
                      value={criteria.monitorThreshold}
                      onChange={(e) => updateCriteria({ monitorThreshold: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <p className="text-[10px] text-slate-400">Score for &ldquo;Monitor&rdquo; band (default: 55)</p>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300">Tenure Minimum (days)</span>
                        <div className="group relative">
                          <Info className="h-3 w-3 text-slate-500 cursor-help" />
                          <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            Minimum number of days a member must have been in the clan to be eligible for Elder promotion. Members below this threshold are marked as &ldquo;Ineligible&rdquo;.
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-slate-100">{criteria.tenureMinimum}</span>
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="180"
                      step="15"
                      value={criteria.tenureMinimum}
                      onChange={(e) => updateCriteria({ tenureMinimum: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <p className="text-[10px] text-slate-400">Minimum days in clan to be eligible (default: 90)</p>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300">Failing Dimension Threshold</span>
                        <div className="group relative">
                          <Info className="h-3 w-3 text-slate-500 cursor-help" />
                          <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            Minimum score required for each individual dimension (Consistency, Generosity, Performance). If any dimension falls below this threshold, it&rsquo;s flagged as a &ldquo;failing dimension&rdquo; in recommendations. Dimensions with zero weight are not checked.
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-slate-100">{criteria.failingDimensionThreshold}</span>
                    </label>
                    <input
                      type="range"
                      min="20"
                      max="60"
                      value={criteria.failingDimensionThreshold}
                      onChange={(e) => updateCriteria({ failingDimensionThreshold: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                    />
                    <p className="text-[10px] text-slate-400">Minimum score per dimension to avoid &ldquo;fail&rdquo; (default: 40)</p>
                  </div>
                </div>

                {/* Weights */}
                <div className="space-y-3 pt-3 border-t border-brand-border/40">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Score Weights</h4>
                    <div className="group relative">
                      <Info className="h-3.5 w-3.5 text-slate-500 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        Weights determine how much each dimension contributes to the final Elder Readiness Score. Weights are automatically normalized to sum to 100%. Setting a weight to 0 excludes that dimension from both scoring and failing dimension checks.
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2">Adjust how much each metric contributes to the final score</p>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300">Consistency Weight</span>
                        <div className="group relative">
                          <Info className="h-3 w-3 text-slate-500 cursor-help" />
                          <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            How much the Consistency dimension (regular activity, war participation, donations) contributes to the final Elder Readiness Score.
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-slate-100">{weightConsistencyPct}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={criteria.weightConsistency}
                      onChange={(e) => updateCriteria({ weightConsistency: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300">Generosity Weight</span>
                        <div className="group relative">
                          <Info className="h-3 w-3 text-slate-500 cursor-help" />
                          <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            How much the Generosity dimension (donations given vs received, clan capital contributions) contributes to the final Elder Readiness Score.
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-slate-100">{weightGenerosityPct}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={criteria.weightGenerosity}
                      onChange={(e) => updateCriteria({ weightGenerosity: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300">Performance Weight</span>
                        <div className="group relative">
                          <Info className="h-3 w-3 text-slate-500 cursor-help" />
                          <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            How much the Performance dimension (war stars, trophy count, overall activity level) contributes to the final Elder Readiness Score.
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-slate-100">{weightPerformancePct}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={criteria.weightPerformance}
                      onChange={(e) => updateCriteria({ weightPerformance: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t border-brand-border/40">
                    <span className="text-[10px] text-slate-500">
                      Total: {totalWeight} ({totalWeight !== 100 ? 'will normalize' : 'balanced'})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Table - Right side on large screens */}
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
              <div className="max-h-[70vh] overflow-y-auto">
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
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="font-semibold text-slate-100">{rec.name}</div>
                              <div className="text-[11px] font-mono uppercase text-slate-500">{rec.playerTag}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyPlayerStatus(rec)}
                              className="shrink-0 rounded p-1.5 text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
                              title="Copy status message for this player"
                            >
                              <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
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
        </div>
      ) : (
        /* Criteria Settings Panel - Full width when no results */
        <div className="rounded-lg border border-brand-border/60 bg-brand-surfaceRaised/40 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-100">Assessment Criteria</h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-600/60 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700/60 hover:text-slate-100"
                title="Reset all criteria to default values"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Reset to Defaults
              </button>
              <button
                type="button"
                onClick={() => setShowCriteriaSettings(!showCriteriaSettings)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showCriteriaSettings ? 'Hide' : 'Show'} Settings
              </button>
            </div>
          </div>

          {showCriteriaSettings && (
            <div className="space-y-4 pt-2 border-t border-brand-border/40">
              {/* Thresholds */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Thresholds</h4>
                  <div className="group relative">
                    <Info className="h-3.5 w-3.5 text-slate-500 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      Score thresholds determine which band (Promote, Monitor, Risk, Ineligible) each candidate falls into based on their Elder Readiness Score.
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300">Promotion Threshold</span>
                      <div className="group relative">
                        <Info className="h-3 w-3 text-slate-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          Minimum Elder Readiness Score required to recommend promotion to Elder status. Scores at or above this threshold are marked as &ldquo;Promote&rdquo;.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-slate-100">{criteria.promotionThreshold}</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="90"
                    value={criteria.promotionThreshold}
                    onChange={(e) => updateCriteria({ promotionThreshold: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-[10px] text-slate-400">Score needed to recommend promotion (default: 70)</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300">Monitor Threshold</span>
                      <div className="group relative">
                        <Info className="h-3 w-3 text-slate-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          Score threshold for the &ldquo;Monitor&rdquo; band. Candidates between Monitor and Promotion thresholds are close but need more observation before promotion.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-slate-100">{criteria.monitorThreshold}</span>
                  </label>
                  <input
                    type="range"
                    min="40"
                    max="75"
                    value={criteria.monitorThreshold}
                    onChange={(e) => updateCriteria({ monitorThreshold: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <p className="text-[10px] text-slate-400">Score for &ldquo;Monitor&rdquo; band (default: 55)</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300">Tenure Minimum (days)</span>
                      <div className="group relative">
                        <Info className="h-3 w-3 text-slate-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          Minimum number of days a member must have been in the clan to be eligible for Elder promotion. Members below this threshold are marked as &ldquo;Ineligible&rdquo;.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-slate-100">{criteria.tenureMinimum}</span>
                  </label>
                  <input
                    type="range"
                    min="30"
                    max="180"
                    step="15"
                    value={criteria.tenureMinimum}
                    onChange={(e) => updateCriteria({ tenureMinimum: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <p className="text-[10px] text-slate-400">Minimum days in clan to be eligible (default: 90)</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300">Failing Dimension Threshold</span>
                      <div className="group relative">
                        <Info className="h-3 w-3 text-slate-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          Minimum score required for each individual dimension (Consistency, Generosity, Performance). If any dimension falls below this threshold, it&rsquo;s flagged as a &ldquo;failing dimension&rdquo; in recommendations. Dimensions with zero weight are not checked.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-slate-100">{criteria.failingDimensionThreshold}</span>
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="60"
                    value={criteria.failingDimensionThreshold}
                    onChange={(e) => updateCriteria({ failingDimensionThreshold: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <p className="text-[10px] text-slate-400">Minimum score per dimension to avoid &ldquo;fail&rdquo; (default: 40)</p>
                </div>
              </div>

              {/* Weights */}
              <div className="space-y-3 pt-3 border-t border-brand-border/40">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Score Weights</h4>
                  <div className="group relative">
                    <Info className="h-3.5 w-3.5 text-slate-500 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      Weights determine how much each dimension contributes to the final Elder Readiness Score. Weights are automatically normalized to sum to 100%. Setting a weight to 0 excludes that dimension from both scoring and failing dimension checks.
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mb-2">Adjust how much each metric contributes to the final score</p>

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300">Consistency Weight</span>
                      <div className="group relative">
                        <Info className="h-3 w-3 text-slate-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          How much the Consistency dimension (regular activity, war participation, donations) contributes to the final Elder Readiness Score.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-slate-100">{weightConsistencyPct}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={criteria.weightConsistency}
                    onChange={(e) => updateCriteria({ weightConsistency: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300">Generosity Weight</span>
                      <div className="group relative">
                        <Info className="h-3 w-3 text-slate-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          How much the Generosity dimension (donations given vs received, clan capital contributions) contributes to the final Elder Readiness Score.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-slate-100">{weightGenerosityPct}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={criteria.weightGenerosity}
                    onChange={(e) => updateCriteria({ weightGenerosity: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300">Performance Weight</span>
                      <div className="group relative">
                        <Info className="h-3 w-3 text-slate-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          How much the Performance dimension (war stars, trophy count, overall activity level) contributes to the final Elder Readiness Score.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-slate-100">{weightPerformancePct}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={criteria.weightPerformance}
                    onChange={(e) => updateCriteria({ weightPerformance: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-brand-border/40">
                  <span className="text-[10px] text-slate-500">
                    Total: {totalWeight} ({totalWeight !== 100 ? 'will normalize' : 'balanced'})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

export default ElderAssessmentCard;
