"use client";

/**
 * QuickActions Component
 * 
 * Provides quick action buttons for common dashboard operations.
 * Handles data copying, AI summary generation, and other utility functions.
 * 
 * Features:
 * - Copy clan data to clipboard
 * - Generate AI summaries
 * - Responsive design
 * - Loading states
 * - Error handling
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React, { useState } from 'react';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { Button, SuccessButton, WarningButton } from '@/components/ui';
import { api } from '@/lib/api/client';

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
  const { roster, clanTag, selectedSnapshot, refreshData, setMessage, setStatus } = useDashboardStore();
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isCopyingData, setIsCopyingData] = useState(false);
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

  const handleGenerateAISummary = async () => {
    if (!clanTag) {
      setMessage('Please load a clan first');
      return;
    }

    setIsGeneratingSummary(true);
    try {
      // Get recent changes for AI summary
      const changesResponse = await api.getSnapshotChanges(clanTag);
      
      if (changesResponse.success && changesResponse.data?.changes) {
        const summaryResponse = await api.generateAISummary(clanTag, changesResponse.data.changes);
        
        if (summaryResponse.success) {
          setMessage('AI summary generated successfully!');
          setStatus('success');
        } else {
          setMessage(summaryResponse.error || 'Failed to generate AI summary');
          setStatus('error');
        }
      } else {
        setMessage('No recent changes found to summarize');
        setStatus('error');
      }
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      setMessage('Failed to generate AI summary');
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
      setMessage(selectedSnapshot === 'live' ? 'Latest data refreshed' : 'Snapshot reloaded');
      setStatus('success');
    } catch (error) {
      console.error('Failed to refresh data:', error);
      setMessage('Failed to refresh data');
      setStatus('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    handleCopyData,
    handleGenerateAISummary,
    handleRefreshData,
    isGeneratingSummary,
    isCopyingData,
    isRefreshing,
    hasData: !!roster,
    memberCount: selectors.memberCount(useDashboardStore.getState())
  };
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const QuickActions: React.FC<QuickActionsProps> = ({ className = '' }) => {
  const aiEnabled = process.env.NEXT_PUBLIC_ENABLE_AI === 'true';
  const {
    handleCopyData,
    handleGenerateAISummary,
    handleRefreshData,
    isGeneratingSummary,
    isCopyingData,
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
        
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Copy Data Button */}
          <Button
            onClick={handleCopyData}
            disabled={!hasData || isCopyingData}
            loading={isCopyingData}
            className="group relative inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 border border-teal-400/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            title="Copy all clan data to clipboard for LLM analysis"
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
            className="group relative inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 border border-blue-400/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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

          {/* AI Summary Button */}
          <Button
            onClick={handleGenerateAISummary}
            disabled={!hasData || isGeneratingSummary || !aiEnabled}
            loading={isGeneratingSummary}
            className="group relative inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-violet-500 to-violet-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 border border-violet-400/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            title={aiEnabled ? "Generate daily summary with AI analysis of changes since last snapshot" : "AI disabled in dev (set NEXT_PUBLIC_ENABLE_AI=true)"}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-400 to-violet-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-0"></div>
            <span className="relative flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              AI Summary
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
