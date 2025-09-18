"use client";

import { useState, useRef, useEffect } from 'react';
import { Wand2 } from 'lucide-react';
import { useQuickActions } from './QuickActions';
import { Button, GlassCard } from '@/components/ui';

interface QuickActionsMenuProps {
  className?: string;
  variant?: 'card' | 'inline';
}

const menuItemClass =
  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed';

export const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({ className = '', variant = 'card' }) => {
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
  const subtitle = hasData ? 'One-click refreshes and exports' : 'Load a clan to enable actions';

  const dropdown = (
    <div className={`relative ${variant === 'inline' ? 'min-w-[220px]' : ''}`} ref={menuRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full justify-between ${variant === 'inline'
          ? 'border-indigo-200 text-indigo-100/90 hover:bg-indigo-500/25'
          : 'border-indigo-300 text-indigo-100 hover:bg-indigo-500/25'}`}
        title={disabledText || 'Open quick actions menu'}
        disabled={!hasData}
      >
        <span>{open ? 'Hide Actions' : 'Launch Actions'}</span>
        <svg className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {open && hasData && (
        <div className="absolute right-0 z-20 mt-3 w-60 overflow-hidden rounded-xl border border-white/15 bg-slate-900/92 shadow-2xl backdrop-blur-lg">
          <div className="p-2">
            <button
              className={`${menuItemClass} hover:bg-white/10`}
              onClick={() => {
                handleRefreshData();
                setOpen(false);
              }}
              disabled={isRefreshing}
            >
              <span>Refresh Data</span>
            </button>
            <button
              className={`${menuItemClass} hover:bg-white/10`}
              onClick={() => {
                handleRefreshInsights();
                setOpen(false);
              }}
              disabled={isRefreshingInsights || smartInsightsStatus === 'loading'}
            >
              <span>Refresh Insights</span>
            </button>
            <button
              className={`${menuItemClass} hover:bg-white/10`}
              onClick={() => {
                handleCopySnapshotSummary();
                setOpen(false);
              }}
            >
              <span>Copy Snapshot Summary</span>
            </button>
            <button
              className={`${menuItemClass} hover:bg-white/10`}
              onClick={() => {
                handleCopyRosterJson();
                setOpen(false);
              }}
            >
              <span>Copy Roster JSON</span>
            </button>
            <button
              className={`${menuItemClass} hover:bg-white/10`}
              onClick={() => {
                handleExportSnapshot('json');
                setOpen(false);
              }}
              disabled={isExporting}
            >
              <span>Export Snapshot JSON</span>
            </button>
            <button
              className={`${menuItemClass} hover:bg-white/10`}
              onClick={() => {
                handleExportSnapshot('csv');
                setOpen(false);
              }}
              disabled={isExporting}
            >
              <span>Export War Log CSV</span>
            </button>
            <button
              className={`${menuItemClass} hover:bg-white/10`}
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

  if (variant === 'inline') {
    return (
      <div className={`flex flex-col gap-1 text-slate-200 ${className}`}>
        {dropdown}
        <div className="text-[11px] text-slate-300">
          Smart Insights status:{' '}
          <span className="font-semibold text-slate-100">{smartInsightsStatus}</span>
        </div>
      </div>
    );
  }

  return (
    <GlassCard
      className={className}
      icon={<Wand2 className="h-5 w-5" />}
      title="Quick Actions"
      subtitle={subtitle}
    >
      <div className="rounded-2xl bg-gradient-to-br from-slate-900/70 via-slate-900/48 to-slate-800/52 px-4 py-5 shadow-inner text-slate-100">
        {dropdown}
        <div className="mt-3 text-xs text-slate-200/80">
          Smart Insights status:{' '}
          <span className="font-semibold text-slate-100">{smartInsightsStatus}</span>
        </div>
      </div>
    </GlassCard>
  );
};

export default QuickActionsMenu;
