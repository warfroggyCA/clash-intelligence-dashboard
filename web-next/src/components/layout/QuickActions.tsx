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
import { Button, SuccessButton, WarningButton } from '@/components/ui';
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

const useQuickActions = () => {
  const {
    roster,
    clanTag,
    selectedSnapshot,
    refreshData,
    setMessage,
    setStatus,
    snapshotMetadata,
    snapshotDetails,
  } = useDashboardStore();
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isCopyingData, setIsCopyingData] = useState(false);
  const [isCopyingSnapshot, setIsCopyingSnapshot] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCopyData = async () => {
    if (!roster) {
      setMessage('No clan data to copy');
      return;
    }

    setIsCopyingData(true);
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
      setMessage('Clan data copied to clipboard!');
      setStatus('success');
    } catch (error) {
      console.error('Failed to copy data:', error);
      setMessage('Failed to copy data to clipboard');
      setStatus('error');
    } finally {
      setIsCopyingData(false);
    }
  };

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

  const handleRefreshData = async () => {
    if (!clanTag) {
      setMessage('Load a clan first to refresh data');
      return;
    }

    setIsRefreshing(true);
    try {
      await refreshData();
      setMessage('Snapshot data refreshed');
      setStatus('success');
    } catch (error) {
      console.error('Failed to refresh data:', error);
      setMessage('Failed to refresh data');
      setStatus('error');
    } finally {
      setIsRefreshing(false);
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
    handleCopyData,
    handleGenerateInsightsSummary,
    handleRefreshData,
    handleCopySnapshotSummary,
    handleExportSnapshot,
    isGeneratingSummary,
    isCopyingData,
    isCopyingSnapshot,
    isExporting,
    isRefreshing,
    hasData: !!roster,
    memberCount: selectors.memberCount(useDashboardStore.getState())
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
    handleCopyData,
    handleGenerateInsightsSummary,
    handleRefreshData,
    handleCopySnapshotSummary,
    handleExportSnapshot,
    isGeneratingSummary,
    isCopyingData,
    isCopyingSnapshot,
    isExporting,
    isRefreshing,
    hasData,
    memberCount
  } = useQuickActions();

  return (
    <section className={`p-4 sm:p-6 rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg border border-white/20 ${className}`}>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
          Quick Actions
        </h3>
        
        <div className="flex flex-wrap gap-2">
          {/* Copy Data Button */}
          <Button
            onClick={handleCopyData}
            disabled={!hasData || isCopyingData}
            loading={isCopyingData}
            className="group relative inline-flex items-center justify-center px-3 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 border border-teal-400/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
            title="Copy raw member data (JSON format) for analysis"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-teal-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            <span className="relative flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              Copy Data
              {hasData && (
                <span className="text-xs bg-white/20 px-2 py-1 rounded">
                  {memberCount} members
                </span>
              )}
            </span>
          </Button>

          {/* Refresh Data Button */}
          <Button
            onClick={handleRefreshData}
            disabled={!hasData || isRefreshing}
            loading={isRefreshing}
            className="group relative inline-flex items-center justify-center px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 border border-blue-400/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
            title="Refresh roster data from the selected source"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            <span className="relative flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582a9 9 0 0117.245 2H23a11 11 0 00-21.338 3H4zm16 11v-5h-.582a9 9 0 00-17.245-2H1a11 11 0 0021.338-3H20z"></path>
              </svg>
              Refresh Data
            </span>
          </Button>

          {/* Snapshot Summary Button */}
          <Button
            onClick={handleCopySnapshotSummary}
            disabled={!hasData || isCopyingSnapshot}
            loading={isCopyingSnapshot}
            className="group relative inline-flex items-center justify-center px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 border border-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
            title="Copy snapshot summary (war status, capital raids, etc.)"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            <span className="relative flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2h2m3-3h6m-6 0a2 2 0 012-2h2a2 2 0 012 2m-6 0v3m6-3v3"></path>
              </svg>
              Copy Summary
            </span>
          </Button>

          {/* Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <Button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!hasData || isExporting}
              className="group relative inline-flex items-center justify-center px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 border border-emerald-400/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
              title="Export snapshot data in various formats"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              <span className="relative flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Export
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"></path>
                </svg>
              </span>
            </Button>

            {/* Export Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleExportSnapshot('json');
                      setShowExportMenu(false);
                    }}
                    disabled={isExporting}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Export War Log CSV
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Insights Summary Button */}
          <Button
            onClick={handleGenerateInsightsSummary}
            disabled={!hasData || isGeneratingSummary || !insightsEnabled}
            loading={isGeneratingSummary}
            className="group relative inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-violet-500 to-violet-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 border border-violet-400/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            title={insightsEnabled ? "Generate daily summary with automated insights of changes since last snapshot" : "Insights disabled in dev (set NEXT_PUBLIC_ENABLE_INSIGHTS=true)"}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-400 to-violet-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-0"></div>
            <span className="relative flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              Insights Summary
            </span>
          </Button>
        </div>
        
        {/* Status Message */}
        {!hasData && (
          <p className="text-sm text-gray-500 italic">
            Load a clan to enable quick actions
          </p>
        )}
      </div>
    </section>
  );
};

export default QuickActions;
