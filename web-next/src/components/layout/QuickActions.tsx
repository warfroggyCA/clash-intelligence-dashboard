"use client";

/**
 * QuickActions Component
 * 
 * Provides quick action buttons for common dashboard operations.
 * Handles data copying, insights summary generation, and other utility functions.
 * 
 * Features:
 * - Copy clan data to clipboard
 * - Generate insights summaries
 * - Responsive design
 * - Loading states
 * - Error handling
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDashboardStore, selectors, useShallow } from '@/lib/stores/dashboard-store';
import { Button } from '@/components/ui';
import { api } from '@/lib/api/client';
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';
import { formatRosterSummary } from '@/lib/export/roster-export';
import type { RosterData } from '@/app/simple-roster/roster-transform';

// =============================================================================
// TYPES
// =============================================================================

export interface QuickActionsProps {
  className?: string;
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

export const useQuickActions = () => {
  // CRITICAL FIX: Don't destructure entire store - subscribe to each field individually
  const roster = useDashboardStore(useShallow((state) => state.roster));
  const clanTag = useDashboardStore((state) => state.clanTag);
  const selectedSnapshot = useDashboardStore((state) => state.selectedSnapshot);
  const refreshData = useDashboardStore((state) => state.refreshData);
  const setMessage = useDashboardStore((state) => state.setMessage);
  const setStatus = useDashboardStore((state) => state.setStatus);
  const snapshotMetadata = useDashboardStore((state) => state.snapshotMetadata);
  const snapshotDetails = useDashboardStore(useShallow((state) => state.snapshotDetails));
  const loadSmartInsights = useDashboardStore((state) => state.loadSmartInsights);
  const smartInsights = useDashboardStore(selectors.smartInsights);
  const smartInsightsStatus = useDashboardStore(selectors.smartInsightsStatus);
  const smartInsightsError = useDashboardStore(selectors.smartInsightsError);
  const smartInsightsIsStale = useDashboardStore(selectors.smartInsightsIsStale);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isCopyingSnapshot, setIsCopyingSnapshot] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const handleGenerateInsightsSummary = async () => {
    if (!clanTag) {
      setMessage('Please load a clan first');
      return;
    }

    setIsGeneratingSummary(true);
    try {
      // Get recent changes for the insights summary
      const changesResponse = await api.getSnapshotChanges(clanTag);
      
      if (changesResponse.success && changesResponse.data?.changes) {
        // Prepare clan data with snapshot metadata for enhanced insights
        const clanData = {
          clanName: roster?.clanName,
          clanTag: roster?.clanTag || clanTag,
          memberCount: roster?.members?.length || 0,
          averageTownHall: roster?.members ? 
            roster.members.reduce((sum, m) => sum + (m.townHallLevel || 0), 0) / roster.members.length : 0,
          averageTrophies: roster?.members ? 
            roster.members.reduce((sum, m) => sum + (m.trophies || 0), 0) / roster.members.length : 0,
          totalDonations: roster?.members ? 
            roster.members.reduce((sum, m) => sum + (m.donations || 0), 0) : 0,
          roleDistribution: roster?.members ? 
            roster.members.reduce((acc, m) => {
              const key = m.role || 'member';
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {} as Record<string, number>) : {},
          members: roster?.members || [],
          snapshotMetadata,
          snapshotDetails,
        };

      const summaryResponse = await api.generateInsightsSummary(clanTag, changesResponse.data.changes, clanData);
        
      if (summaryResponse.success && summaryResponse.data?.summary) {
        await navigator.clipboard.writeText(summaryResponse.data.summary);
        setMessage('Insights summary copied to clipboard!');
        setStatus('success');
      } else {
        setMessage(summaryResponse.error || 'Failed to generate insights summary');
        setStatus('error');
      }
    } else {
      setMessage('No recent changes found to summarize');
      setStatus('error');
      }
    } catch (error) {
      console.error('Failed to generate insights summary:', error);
      setMessage('Failed to generate insights summary');
      setStatus('error');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleCopyRosterJson = async () => {
    if (!roster) {
      setMessage('No clan data to copy');
      return;
    }

    try {
      const dataToCopy = {
        clanName: roster.clanName,
        clanTag: roster.clanTag,
        memberCount: roster.members.length,
        members: roster.members.map(member => ({
          name: member.name,
          tag: member.tag,
          townHallLevel: member.townHallLevel,
          trophies: member.trophies,
          donations: member.donations,
          donationsReceived: member.donationsReceived,
          role: member.role,
          tenure: member.tenure_days || member.tenure,
          heroes: {
            bk: member.bk,
            aq: member.aq,
            gw: member.gw,
            rc: member.rc,
            mp: member.mp
          }
        })),
        lastUpdated: new Date().toISOString()
      };

      await navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      setMessage('Roster JSON copied');
      setStatus('success');
    } catch (error) {
      console.error('Failed to copy roster JSON:', error);
      setMessage('Failed to copy roster JSON');
      setStatus('error');
    }
  };

  const handleRefreshAll = async () => {
    if (!clanTag) {
      setMessage('Load a clan first to refresh the dashboard');
      return;
    }

    setIsRefreshingAll(true);
    try {
      await refreshData();
      await loadSmartInsights(clanTag, { force: true, ttlMs: 0 });
      setMessage('Snapshot data and smart insights refreshed');
      setStatus('success');
    } catch (error) {
      console.error('Failed to refresh dashboard data:', error);
      setMessage('Failed to refresh dashboard data');
      setStatus('error');
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleCopySnapshotSummary = async () => {
    if (!snapshotMetadata) {
      setMessage('No snapshot metadata available yet');
      return;
    }

    setIsCopyingSnapshot(true);
    try {
      const lines: string[] = [];
      const fmtDate = safeLocaleDateString(snapshotMetadata.snapshotDate, {
        options: { year: 'numeric', month: 'short', day: 'numeric' },
        fallback: 'Unknown Date',
        context: 'QuickActions snapshotMetadata.snapshotDate'
      });
      const fmtTime = safeLocaleString(snapshotMetadata.fetchedAt, {
        options: {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        },
        fallback: 'Unknown',
        context: 'QuickActions snapshotMetadata.fetchedAt'
      });

      lines.push(`# Clan Snapshot – ${fmtDate}`);
      if (roster?.clanName) {
        lines.push(`**Clan:** ${roster.clanName} (${snapshotMetadata.version})`);
      }
      lines.push(`**Members:** ${snapshotMetadata.memberCount}`);
      lines.push(`**Fetched At:** ${fmtTime}`);
      lines.push('');

      if (snapshotDetails?.currentWar) {
        const war = snapshotDetails.currentWar;
        const opponent = war.opponent ? `${war.opponent.name} (${war.opponent.tag})` : 'Unknown opponent';
        lines.push('## Current War');
        lines.push(`- State: ${war.state || 'unknown'}`);
        lines.push(`- Team Size: ${war.teamSize}${war.attacksPerMember ? ` x${war.attacksPerMember}` : ''}`);
        lines.push(`- Opponent: ${opponent}`);
        if (war.startTime) {
          lines.push(`- Starts: ${safeLocaleString(war.startTime, {
            fallback: 'Unknown',
            context: 'QuickActions war.startTime'
          })}`);
        }
        if (war.endTime) {
          lines.push(`- Ends: ${safeLocaleString(war.endTime, {
            fallback: 'Unknown',
            context: 'QuickActions war.endTime'
          })}`);
        }
        lines.push('');
      }

      if (snapshotDetails?.warLog?.length) {
        lines.push('## Recent War Log');
        snapshotDetails.warLog.slice(0, 3).forEach((entry, idx) => {
          const end = safeLocaleDateString(entry.endTime, {
            fallback: 'Unknown Date',
            context: 'QuickActions warLog entry endTime'
          });
          lines.push(`- ${end}: ${entry.result || 'Unknown'} vs ${entry.opponent.name} (${entry.teamSize}x${entry.attacksPerMember})`);
        });
        lines.push('');
      }

      if (snapshotDetails?.capitalRaidSeasons?.length) {
        lines.push('## Capital Raids');
        snapshotDetails.capitalRaidSeasons.slice(0, 2).forEach((season) => {
          const end = safeLocaleDateString(season.endTime, {
            fallback: 'Unknown Date',
            context: 'QuickActions capital raid season endTime'
          });
          lines.push(
            `- ${end}: Hall ${season.capitalHallLevel} – ${season.state || 'unknown'}, Offensive ${season.offensiveLoot.toLocaleString()}, Defensive ${season.defensiveLoot.toLocaleString()}`
          );
        });
        lines.push('');
      }

      if (roster?.members?.length) {
        const rosterExportPayload: RosterData = {
          members: roster.members as any,
          clanName: roster.clanName || 'Unknown Clan',
          clanTag: roster.clanTag || '#UNKNOWN',
          date: snapshotMetadata.snapshotDate ?? roster.date ?? null,
          snapshotMetadata: {
            snapshotDate: snapshotMetadata.snapshotDate ?? null,
            fetchedAt: snapshotMetadata.fetchedAt ?? null,
            memberCount: snapshotMetadata.memberCount ?? roster.members.length,
            warLogEntries: snapshotMetadata.warLogEntries ?? 0,
            capitalSeasons: snapshotMetadata.capitalSeasons ?? 0,
            version: snapshotMetadata.version ?? 'unknown',
            payloadVersion: snapshotMetadata.payloadVersion ?? null,
            ingestionVersion: snapshotMetadata.ingestionVersion ?? null,
            schemaVersion: snapshotMetadata.schemaVersion ?? null,
            computedAt: snapshotMetadata.computedAt ?? null,
            seasonId: snapshotMetadata.seasonId ?? null,
            seasonStart: snapshotMetadata.seasonStart ?? null,
            seasonEnd: snapshotMetadata.seasonEnd ?? null,
          },
          clanHeroAverages: ('clanHeroAverages' in (roster as any)) ? (roster as any).clanHeroAverages : undefined,
        };

        const rosterTable = formatRosterSummary(rosterExportPayload);
        lines.push('## Roster Data (Tab Separated)');
        lines.push('```');
        lines.push(rosterTable);
        lines.push('```');
        lines.push('');
      }

      lines.push('---');
      lines.push(`Generated from nightly snapshot (version ${snapshotMetadata.version}).`);
      await navigator.clipboard.writeText(lines.join('\n'));
      setMessage('Snapshot summary copied to clipboard!');
      setStatus('success');
    } catch (error) {
      console.error('Failed to copy snapshot summary:', error);
      setMessage('Failed to copy snapshot summary');
      setStatus('error');
    } finally {
      setIsCopyingSnapshot(false);
    }
  };


  const handleExportSnapshot = async (format: 'json' | 'csv') => {
    if (!snapshotMetadata || !snapshotDetails) {
      setMessage('No snapshot data available for export');
      return;
    }

    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `clan-snapshot-${snapshotMetadata.snapshotDate}-${timestamp}`;

      if (format === 'json') {
        const exportData = {
          metadata: snapshotMetadata,
          details: snapshotDetails,
          clanInfo: {
            name: roster?.clanName,
            tag: roster?.clanTag,
            memberCount: snapshotMetadata.memberCount
          },
          exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (format === 'csv') {
        // Export war log as CSV
        if (snapshotDetails.warLog?.length) {
          const headers = ['Date', 'Result', 'Opponent Name', 'Opponent Tag', 'Team Size', 'Attacks Per Member'];
          const csvRows = [headers.join(',')];
          
          snapshotDetails.warLog.forEach(war => {
            const row = [
              safeLocaleDateString(war.endTime, {
                fallback: 'Unknown Date',
                context: 'QuickActions export warLog endTime'
              }),
              war.result || 'Unknown',
              `"${war.opponent.name}"`,
              war.opponent.tag,
              war.teamSize,
              war.attacksPerMember
            ];
            csvRows.push(row.join(','));
          });

          const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}-war-log.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }

      setMessage(`${format.toUpperCase()} export downloaded successfully!`);
      setStatus('success');
    } catch (error) {
      console.error(`Failed to export ${format}:`, error);
      setMessage(`Failed to export ${format.toUpperCase()}`);
      setStatus('error');
    } finally {
      setIsExporting(false);
    }
  };

  return {
    handleGenerateInsightsSummary,
    handleRefreshAll,
    handleCopySnapshotSummary,
    handleCopyRosterJson,
    handleExportSnapshot,
    isGeneratingSummary,
    isCopyingSnapshot,
    isExporting,
    isRefreshingAll,
    smartInsightsStatus,
    smartInsightsError,
    smartInsightsIsStale,
    smartInsightsMetadata: smartInsights?.metadata ?? null,
    hasData: !!roster,
  };
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const QuickActions: React.FC<QuickActionsProps> = ({ className = '' }) => {
  const insightsEnabled = process.env.NEXT_PUBLIC_ENABLE_INSIGHTS === 'true';
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportAnchor, setExportAnchor] = useState<'desktop' | 'mobile'>('desktop');
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);
  const {
    handleGenerateInsightsSummary,
    handleRefreshAll,
    handleCopySnapshotSummary,
    handleCopyRosterJson,
    handleExportSnapshot,
    isGeneratingSummary,
    isCopyingSnapshot,
    isExporting,
    isRefreshingAll,
    smartInsightsStatus,
    smartInsightsError,
    smartInsightsIsStale,
    smartInsightsMetadata,
    hasData,
  } = useQuickActions();

  const actionButtonBaseClasses =
    'quick-action-btn inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400';
  const linkButtonClasses = `${actionButtonBaseClasses} bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white shadow-xl hover:shadow-2xl hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 border border-blue-400/30 backdrop-blur-sm no-underline`;

  const statusLabel = smartInsightsStatus === 'loading'
    ? 'Refreshing'
    : smartInsightsStatus === 'error'
      ? 'Error'
      : smartInsightsIsStale
        ? 'Stale'
        : 'Fresh';

  const statusTone = smartInsightsStatus === 'loading'
    ? 'bg-brand-surfaceRaised/60 text-slate-200'
    : smartInsightsStatus === 'error'
      ? 'bg-rose-500/20 text-rose-200'
      : smartInsightsIsStale
        ? 'bg-amber-400/20 text-amber-200'
        : 'bg-emerald-400/20 text-emerald-200';

  const snapshotSummary = snapshotMetadata
    ? `${'Snapshot '}${safeLocaleDateString(snapshotMetadata.snapshotDate, {
        fallback: snapshotMetadata.snapshotDate,
        context: 'QuickActions snapshotSummary'
      })}${snapshotMetadata.fetchedAt ? ` • Generated ${safeLocaleString(snapshotMetadata.fetchedAt, {
        fallback: snapshotMetadata.fetchedAt,
        context: 'QuickActions snapshotGeneratedAt'
      })}` : ''}`
    : 'Snapshot timing unavailable';

  const renderExportMenu = (variant: 'mobile' | 'desktop') => (
    <div
      className={`absolute ${
        variant === 'mobile' ? 'left-0 mt-1' : 'right-0 mt-2'
      } w-48 rounded-2xl border border-brand-border/80 bg-brand-surfaceRaised/95 shadow-[0_18px_38px_-28px_rgba(8,15,31,0.72)] backdrop-blur-lg z-20`}
    >
      <div className="py-1">
        <button
          onClick={() => {
            handleExportSnapshot('json');
            setShowExportMenu(false);
          }}
          disabled={isExporting}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-brand-surfaceSubtle"
        >
          <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          Export JSON
        </button>
        <button
          onClick={() => {
            handleExportSnapshot('csv');
            setShowExportMenu(false);
          }}
          disabled={isExporting}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-brand-surfaceSubtle"
        >
          <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Export War Log CSV
        </button>
        <button
          onClick={() => {
            handleCopyRosterJson();
            setShowExportMenu(false);
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-brand-surfaceSubtle"
        >
          <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2z"></path>
          </svg>
          Copy Roster JSON
        </button>
      </div>
    </div>
  );

  return (
    <div className={`${className || ''} space-y-3`} ref={exportMenuRef}>
      {/* Compact mobile quick actions */}
      <section className="rounded-2xl border border-brand-border/50 bg-brand-surfaceRaised/80 px-3 py-3 text-slate-100 shadow-[0_8px_20px_-16px_rgba(8,15,31,0.65)] sm:hidden">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-slate-400">
          <span>Quick Actions</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${statusTone}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {statusLabel}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{snapshotSummary}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            onClick={handleRefreshAll}
            disabled={!hasData || isRefreshingAll}
            loading={isRefreshingAll}
            variant="primary"
            size="sm"
            className="w-full text-xs py-2"
          >
            Refresh
          </Button>
          <a
            href="/war/prep"
            className="w-full inline-flex items-center justify-center rounded-xl border border-blue-500/40 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-lg"
            title="War Prep workspace (opens new page)"
          >
            War Prep
          </a>
          <Button
            onClick={handleCopySnapshotSummary}
            disabled={!hasData || isCopyingSnapshot}
            loading={isCopyingSnapshot}
            variant="primary"
            size="sm"
            className="w-full text-xs py-2"
          >
            Copy Summary
          </Button>
          <Button
            onClick={handleGenerateInsightsSummary}
            disabled={!hasData || isGeneratingSummary || !insightsEnabled}
            loading={isGeneratingSummary}
            variant="outline"
            size="sm"
            className="w-full text-xs py-2"
            title={insightsEnabled ? 'Generate daily summary with automated insights' : 'Insights disabled in dev (set NEXT_PUBLIC_ENABLE_INSIGHTS=true)'}
          >
            Insights
          </Button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="relative">
            <Button
              onClick={() => {
                setExportAnchor('mobile');
                setShowExportMenu((prev) => !prev);
              }}
              disabled={!hasData || isExporting}
              variant="primary"
              size="sm"
              className="w-full text-xs py-2"
            >
              Export
            </Button>
            {showExportMenu && exportAnchor === 'mobile' && renderExportMenu('mobile')}
          </div>
          <Button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            variant="ghost"
            size="sm"
            className="w-full text-xs py-2 text-slate-300"
          >
            Top ↑
          </Button>
        </div>
      </section>

      {/* Desktop / tablet layout */}
      <section className="quick-actions-card hidden rounded-2xl border border-brand-border/50 bg-brand-surfaceRaised/90 px-4 py-3 text-slate-100 shadow-[0_12px_30px_-24px_rgba(8,15,31,0.68)] sm:block">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3 text-[11px]">
          <div className="flex flex-col gap-1 text-slate-300">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200">Quick Actions</h3>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold uppercase tracking-[0.18em] ${statusTone}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                {statusLabel}
              </span>
              {smartInsightsMetadata?.source && (
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-border/50 bg-brand-surfaceSubtle/70 px-2 py-0.5 text-slate-200 capitalize">
                  {smartInsightsMetadata.source.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>{snapshotSummary}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            Applies to the active clan snapshot
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleRefreshAll}
            disabled={!hasData || isRefreshingAll}
            loading={isRefreshingAll}
            variant="primary"
            size="sm"
            className={`${actionButtonBaseClasses} w-full sm:w-auto`}
            title="Refresh snapshot data and smart insights"
          >
            <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582a9 9 0 0117.245 2H23a11 11 0 00-21.338 3H4zm16 11v-5h-.582a9 9 0 00-17.245-2H1a11 11 0 0021.338-3H20z"></path>
            </svg>
            <span className="flex items-center gap-2">
              Refresh Data & Insights
              {smartInsightsIsStale && !isRefreshingAll && (
                <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">Stale</span>
              )}
            </span>
          </Button>
          <a
            href="/war/prep"
            className={`${linkButtonClasses} w-full sm:w-auto inline-flex`}
            title="War Prep workspace (opens new page)"
          >
            <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.657 0 3-1.343 3-3S13.657 2 12 2 9 3.343 9 5s1.343 3 3 3zm0 2c-3.866 0-7 2.239-7 5v3h14v-3c0-2.761-3.134-5-7-5z" />
            </svg>
            <span>War Prep</span>
            <span className="ml-1 text-xs opacity-60">→</span>
          </a>

          <Button
            onClick={handleCopySnapshotSummary}
            disabled={!hasData || isCopyingSnapshot}
            loading={isCopyingSnapshot}
            variant="primary"
            size="sm"
            className={`${actionButtonBaseClasses} w-full sm:w-auto`}
            title="Copy snapshot summary (war status, capital raids, etc.)"
          >
            <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2h2m3-3h6m-6 0a2 2 0 012-2h2a2 2 0 012 2m-6 0v3m6-3v3"></path>
            </svg>
            <span>Copy Summary</span>
          </Button>
          <Button
            onClick={handleGenerateInsightsSummary}
            disabled={!hasData || isGeneratingSummary || !insightsEnabled}
            loading={isGeneratingSummary}
            variant="primary"
            size="sm"
            className={`${actionButtonBaseClasses} w-full sm:w-auto`}
            title={insightsEnabled ? "Generate daily summary with automated insights of changes since last snapshot" : "Insights disabled in dev (set NEXT_PUBLIC_ENABLE_INSIGHTS=true)"}
          >
            <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            <span>Insights Summary</span>
          </Button>

          <div className="relative ml-auto" ref={exportMenuRef}>
            <Button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!hasData || isExporting}
              variant="primary"
              size="sm"
              className={`${actionButtonBaseClasses} relative w-full pr-8 sm:w-auto`}
              title="Export snapshot data in various formats"
            >
              <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span className="flex items-center gap-2">Export</span>
              <svg className="absolute right-3 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"></path>
              </svg>
            </Button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-brand-border/80 bg-brand-surfaceRaised/95 shadow-[0_18px_38px_-28px_rgba(8,15,31,0.72)] backdrop-blur-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleExportSnapshot('json');
                      setShowExportMenu(false);
                    }}
                    disabled={isExporting}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-brand-surfaceSubtle"
                  >
                    <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Export JSON
                  </button>
                  <button
                    onClick={() => {
                      handleExportSnapshot('csv');
                      setShowExportMenu(false);
                    }}
                    disabled={isExporting}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-brand-surfaceSubtle"
                  >
                    <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Export War Log CSV
                  </button>
                  <button
                    onClick={() => {
                      handleCopyRosterJson();
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-brand-surfaceSubtle"
                  >
                    <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    Copy Roster JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {smartInsightsError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {smartInsightsError}
          </div>
        )}

        {!hasData && (
          <p className="text-sm text-slate-400 italic">Load a clan to enable quick actions</p>
        )}
      </div>
    </section>
    </div>
  );
};

export default QuickActions;
