/**
 * War Analytics Page
 * Displays comprehensive war performance intelligence
 */

import { cookies } from 'next/headers';
import dynamicImport from 'next/dynamic';
// DashboardLayout is now provided by the parent layout
import LeadershipGuard from '@/components/LeadershipGuard';
import BreadcrumbsClient from '@/components/ui/BreadcrumbsClient';

// Lazy load the dashboard component
const WarIntelligenceDashboard = dynamicImport(
  () => import('@/components/war/WarIntelligenceDashboard')
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WarAnalyticsPage() {
  // Try to get clanTag from cookie
  const cookieStore = await cookies();
  const cookieClanTag = cookieStore.get('currentClanTag')?.value;

  return (
    <>
      <LeadershipGuard requiredPermission="canViewLeadershipFeatures">
        <div className="space-y-6">
          <BreadcrumbsClient className="mb-2" />
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <h1 className="text-3xl font-bold text-white mb-2">War Performance Intelligence</h1>
            <p className="text-slate-400">
              Comprehensive analytics and metrics for clan war performance. Track attack efficiency,
              consistency, defensive performance, and identify coaching opportunities.
            </p>
          </div>

          <WarIntelligenceDashboard clanTag={cookieClanTag || undefined} />
        </div>
      </LeadershipGuard>
    </>
  );
}

