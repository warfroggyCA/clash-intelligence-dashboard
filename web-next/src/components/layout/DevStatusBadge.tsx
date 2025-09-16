"use client";

import React from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';

export default function DevStatusBadge() {
  if (process.env.NODE_ENV !== 'development') return null;
  const { lastLoadInfo, status } = useDashboardStore();

  if (!lastLoadInfo) return null;
  const { source, ms, tenureMatches, total } = lastLoadInfo;

  const color = source === 'live' ? 'bg-emerald-600' : source === 'snapshot' ? 'bg-sky-600' : 'bg-gray-600';
  const displaySource = source === 'snapshot' ? 'Latest snapshot' : source;

  return (
    <div className="flex items-center gap-2 text-white text-xs font-medium w-fit px-3 py-1 rounded-full shadow-md"
      style={{ background: 'linear-gradient(90deg, rgba(31,41,55,0.9), rgba(55,65,81,0.9))' }}
      title={`Source: ${source} • Load: ${ms}ms • Tenure: ${tenureMatches}/${total} • Status: ${status}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${color.replace('bg-', 'bg-')}`} />
      <span>Source: {displaySource}</span>
      <span>• {ms}ms</span>
      <span>• Tenure {tenureMatches}/{total}</span>
    </div>
  );
}

