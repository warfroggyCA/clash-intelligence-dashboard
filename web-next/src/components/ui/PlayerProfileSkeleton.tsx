import React from 'react';
import { Skeleton, SkeletonCard } from './Skeleton';

/**
 * Skeleton loader for the Player Profile page
 * Matches the structure of the actual player profile
 */
export function PlayerProfileSkeleton() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Back Button & Header */}
      <div className="mb-6">
        <Skeleton width="w-24" height="h-10" variant="rounded" className="mb-4" />
        <div className="flex items-center gap-4">
          <Skeleton variant="circular" width="w-20" height="h-20" />
          <div className="flex-1">
            <Skeleton width="w-48" height="h-8" className="mb-2" />
            <Skeleton width="w-32" height="h-4" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-2 border-b border-slate-700">
        {['Overview', 'History', 'Metrics', 'Analysis'].map((tab) => (
          <Skeleton key={tab} width="w-24" height="h-10" variant="rounded" className="mb-2" />
        ))}
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Main Content Cards */}
      <div className="space-y-6">
        {/* VIP Score Card */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <Skeleton width="w-32" height="h-6" className="mb-4" />
          <Skeleton width="w-24" height="h-12" className="mb-4" />
          <div className="space-y-2">
            <Skeleton width="w-full" height="h-3" />
            <Skeleton width="w-3/4" height="h-3" />
            <Skeleton width="w-1/2" height="h-3" />
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
              <Skeleton width="w-40" height="h-5" className="mb-4" />
              <Skeleton width="w-full" height="h-64" variant="rounded" />
            </div>
          ))}
        </div>

        {/* Hero Levels Card */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <Skeleton width="w-32" height="h-6" className="mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton variant="circular" width="w-16" height="h-16" className="mx-auto mb-2" />
                <Skeleton width="w-12" height="h-4" className="mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

