import React from 'react';
import { Metadata } from 'next';
import { normalizeTag } from '@/lib/tags';
import { notFound } from 'next/navigation';
import TrophyChart from '@/components/player/TrophyChart';
import DonationChart from '@/components/player/DonationChart';
import HeroUpgradeHistory from '@/components/player/HeroUpgradeHistory';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Disable caching - always fetch fresh player data
export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface PlayerHistoryPageProps {
  params: {
    tag: string;
  };
  searchParams?: {
    days?: string;
  };
}

async function fetchPlayerHistory(tag: string, days: number = 30) {
  const port = process.env.PORT || '3333';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : `http://localhost:${port}`);
  const response = await fetch(
    `${baseUrl}/api/player/${encodeURIComponent(tag)}/history?days=${days}`,
    { cache: 'no-store' }
  );
  
  if (!response.ok) {
    return null;
  }
  
  return response.json();
}

export async function generateMetadata({ params }: PlayerHistoryPageProps): Promise<Metadata> {
  const normalizedTag = normalizeTag(params.tag);

  return {
    title: `${normalizedTag} • Player History`,
    description: `Historical analytics and progression data for player ${normalizedTag}.`,
  };
}

export default async function PlayerHistoryPage({ params, searchParams }: PlayerHistoryPageProps) {
  const normalizedTag = normalizeTag(params.tag);
  const days = parseInt(searchParams?.days || '30');
  
  const result = await fetchPlayerHistory(normalizedTag, days);

  if (!result || !result.success) {
    notFound();
  }

  const { data, meta } = result;

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {meta.playerName}
              </h1>
              <p className="text-slate-400 mt-1">
                {meta.playerTag} • Last {meta.days} days • {meta.dataPointsFound} data points
              </p>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TrophyChart data={data.filter(point => {
            // Filter to only include data from Ranked League start date (Oct 6, 2025) onwards
            // Use date string comparison to avoid timezone issues - strictly exclude Oct 5 and earlier
            const pointDateStr = point.date.includes('T') 
              ? point.date.split('T')[0] 
              : point.date.substring(0, 10); // Extract YYYY-MM-DD
            return pointDateStr > '2025-10-05'; // Exclude Oct 5, include Oct 6 onwards
          })} />
          <DonationChart data={data} />
        </div>

        {/* Hero Upgrade History */}
        <HeroUpgradeHistory data={data} />

        {/* Data Source Info */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-sm text-slate-400">
            Data source: <span className="text-slate-300 font-medium">{meta.dataSource}</span>
            {meta.includeDeltas && ' • Delta calculations enabled'}
          </p>
        </div>
      </div>
    </div>
  );
}
