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
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { Button } from '@/components/ui';
import { api } from '@/lib/api/client';
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';

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
  const {
    roster,
    clanTag,
    selectedSnapshot,
    refreshData,
    setMessage,
    setStatus,
    snapshotMetadata,
    snapshotDetails,
    loadSmartInsights,
  } = useDashboardStore();
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
        
        if (summaryResponse.success) {
          setMessage('Insights summary generated successfully!');
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
  const exportMenuRef = useRef<HTMLDivElement>(null);

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

  const actionButtonClasses = 'quick-action-btn inline-flex items-center justify-center gap-2 rounded-full border border-brand-border/60 !bg-brand-surfaceRaised/80 !text-slate-100 px-3 py-2 text-xs font-semibold shadow-none transition-colors duration-150 hover:!bg-brand-surfaceSubtle/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40';

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

  const snapshotSummary = smartInsightsMetadata
    ? `${'Snapshot '}${safeLocaleDateString(smartInsightsMetadata.snapshotDate, {
        fallback: smartInsightsMetadata.snapshotDate,
        context: 'QuickActions snapshotSummary'
      })}${smartInsightsMetadata.generatedAt ? ` • Generated ${safeLocaleString(smartInsightsMetadata.generatedAt, {
        fallback: smartInsightsMetadata.generatedAt,
        context: 'QuickActions snapshotGeneratedAt'
      })}` : ''}`
    : 'Snapshot timing unavailable';

  return (
    <section className={`quick-actions-card rounded-2xl border border-brand-border/50 bg-brand-surfaceRaised/90 px-4 py-3 text-slate-100 shadow-[0_12px_30px_-24px_rgba(8,15,31,0.68)] ${className}`}>
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
            variant="ghost"
            size="sm"
            className={`${actionButtonClasses} w-full sm:w-auto`}
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

          <Button
            onClick={handleCopySnapshotSummary}
            disabled={!hasData || isCopyingSnapshot}
            loading={isCopyingSnapshot}
            variant="ghost"
            size="sm"
            className={`${actionButtonClasses} w-full sm:w-auto`}
            title="Copy snapshot summary (war status, capital raids, etc.)"
          >
            <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2h2m3-3h6m-6 0a2 2 0 012-2h2a2 2 0 012 2m-6 0v3m6-3v3"></path>
            </svg>
            <span>Copy Summary</span>
          </Button>

          <div className="relative" ref={exportMenuRef}>
            <Button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!hasData || isExporting}
              variant="ghost"
              size="sm"
              className={`${actionButtonClasses} w-full pr-8 sm:w-auto`}
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

          <Button
            onClick={handleGenerateInsightsSummary}
            disabled={!hasData || isGeneratingSummary || !insightsEnabled}
            loading={isGeneratingSummary}
            variant="ghost"
            size="sm"
            className={`${actionButtonClasses} w-full sm:w-auto`}
            title={insightsEnabled ? "Generate daily summary with automated insights of changes since last snapshot" : "Insights disabled in dev (set NEXT_PUBLIC_ENABLE_INSIGHTS=true)"}
          >
            <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            <span>Insights Summary</span>
          </Button>
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
  );
};

export default QuickActions;
