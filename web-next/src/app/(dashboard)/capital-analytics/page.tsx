/**
 * Capital Analytics Page
 * Displays comprehensive capital raid performance analytics
 */

import { cookies } from 'next/headers';
import dynamicImport from 'next/dynamic';
// DashboardLayout is now provided by the parent layout
import LeadershipGuard from '@/components/LeadershipGuard';
import BreadcrumbsClient from '@/components/ui/BreadcrumbsClient';

// Lazy load the dashboard component
const CapitalAnalyticsDashboard = dynamicImport(
  () => import('@/components/capital/CapitalAnalyticsDashboard')
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CapitalAnalyticsPage() {
  // Try to get clanTag from cookie
  const cookieStore = await cookies();
  const cookieClanTag = cookieStore.get('currentClanTag')?.value;

  return (
    <>
      <LeadershipGuard requiredPermission="canViewLeadershipFeatures">
        <div className="space-y-6">
          <BreadcrumbsClient className="mb-2" />
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <h1 className="text-3xl font-bold text-white mb-2">Capital Raid Analytics</h1>
            <p className="text-slate-400">
              Comprehensive analytics and metrics for capital raid performance. Track loot efficiency,
              carry scores, participation rates, and ROI to identify top performers and improvement opportunities.
            </p>
          </div>

          <CapitalAnalyticsDashboard clanTag={cookieClanTag || undefined} />
        </div>
      </LeadershipGuard>
    </>
  );
}

