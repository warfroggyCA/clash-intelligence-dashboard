"use client";

import { useState, useRef, useEffect } from 'react';
import { useQuickActions } from './QuickActions';
import { Button } from '@/components/ui';

interface QuickActionsMenuProps {
  className?: string;
}

const menuItemClass =
  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 transition';

export const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({ className = '' }) => {
  const {
    handleGenerateInsightsSummary,
    handleRefreshData,
    handleRefreshInsights,
    handleCopySnapshotSummary,
    handleCopyRosterJson,
    handleExportSnapshot,
    isGeneratingSummary,
    isRefreshing,
    isRefreshingInsights,
    isExporting,
    hasData,
    smartInsightsStatus,
  } = useQuickActions();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const disabledText = !hasData ? 'Load a clan to enable actions' : '';

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full justify-between border border-slate-200 !bg-white text-slate-700 hover:bg-slate-100"
        title={disabledText || 'Open quick actions menu'}
        disabled={!hasData}
      >
        <span>Quick Actions</span>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {open && hasData && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <button
              className={menuItemClass}
              onClick={() => {
                handleRefreshData();
                setOpen(false);
              }}
              disabled={isRefreshing}
            >
              <span>Refresh Data</span>
            </button>
            <button
              className={menuItemClass}
              onClick={() => {
                handleRefreshInsights();
                setOpen(false);
              }}
              disabled={isRefreshingInsights || smartInsightsStatus === 'loading'}
            >
              <span>Refresh Insights</span>
            </button>
            <button
              className={menuItemClass}
              onClick={() => {
                handleCopySnapshotSummary();
                setOpen(false);
              }}
            >
              <span>Copy Snapshot Summary</span>
            </button>
            <button
              className={menuItemClass}
              onClick={() => {
                handleCopyRosterJson();
                setOpen(false);
              }}
            >
              <span>Copy Roster JSON</span>
            </button>
            <button
              className={menuItemClass}
              onClick={() => {
                handleExportSnapshot('json');
                setOpen(false);
              }}
              disabled={isExporting}
            >
              <span>Export Snapshot JSON</span>
            </button>
            <button
              className={menuItemClass}
              onClick={() => {
                handleExportSnapshot('csv');
                setOpen(false);
              }}
              disabled={isExporting}
            >
              <span>Export War Log CSV</span>
            </button>
            <button
              className={menuItemClass}
              onClick={() => {
                handleGenerateInsightsSummary();
                setOpen(false);
              }}
              disabled={isGeneratingSummary}
            >
              <span>Generate Insights Summary</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickActionsMenu;
