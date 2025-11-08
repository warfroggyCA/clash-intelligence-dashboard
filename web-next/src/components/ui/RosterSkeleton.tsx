import React from 'react';
import { Skeleton, SkeletonCard } from './Skeleton';

/**
 * Skeleton loader for the Roster page
 * Matches the structure of the actual roster table
 */
export function RosterSkeleton() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <Skeleton width="w-48" height="h-9" className="mb-2" />
            <Skeleton width="w-96" height="h-4" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Skeleton width="w-32" height="h-10" variant="rounded" />
            <Skeleton width="w-24" height="h-10" variant="rounded" />
            <Skeleton width="w-20" height="h-10" variant="rounded" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Skeleton width="w-20" height="h-3" className="mb-2" />
                <Skeleton width="w-12" height="h-7" />
              </div>
              <Skeleton variant="circular" width="w-10" height="h-10" />
            </div>
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Table Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-slate-700 bg-slate-800/30">
            <Skeleton width="w-12" height="h-4" />
            <Skeleton width="w-32" height="h-4" />
            <Skeleton width="w-20" height="h-4" />
            <Skeleton width="w-16" height="h-4" />
            <Skeleton width="w-20" height="h-4" />
            <Skeleton width="w-16" height="h-4" />
            <Skeleton width="w-20" height="h-4" />
            <Skeleton width="w-16" height="h-4" />
            <Skeleton width="w-20" height="h-4" />
            <Skeleton width="w-16" height="h-4" />
            <Skeleton width="w-12" height="h-4" />
          </div>

          {/* Table Rows */}
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors"
            >
              <Skeleton variant="circular" width="w-10" height="h-10" />
              <div className="flex items-center gap-2">
                <Skeleton width="w-24" height="h-4" />
                <Skeleton width="w-16" height="h-3" variant="rounded" />
              </div>
              <Skeleton width="w-12" height="h-5" variant="rounded" />
              <Skeleton width="w-16" height="h-4" />
              <Skeleton width="w-20" height="h-4" />
              <Skeleton width="w-16" height="h-4" />
              <Skeleton width="w-20" height="h-4" />
              <Skeleton width="w-16" height="h-4" />
              <Skeleton width="w-20" height="h-4" />
              <Skeleton width="w-16" height="h-4" />
              <Skeleton width="w-8" height="h-8" variant="rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

