import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';
import Card from '@/components/new-ui/Card';
import TrophyChart from '@/components/player/TrophyChart';
import DonationChart from '@/components/player/DonationChart';
import HeroUpgradeHistory from '@/components/player/HeroUpgradeHistory';
import { normalizeTag } from '@/lib/tags';
import { getRequestOrigin } from '@/lib/app-origin';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface PlayerHistoryPageProps {
  params: Promise<{
    tag: string;
  }>;
  searchParams?: Promise<{
    days?: string;
  }>;
}

async function fetchPlayerHistory(tag: string, days: number) {
  const origin = await getRequestOrigin();
  const response = await fetch(
    `${origin}/api/player/${encodeURIComponent(tag)}/history?days=${days}`,
    { cache: 'no-store' },
  );
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export default async function PlayerHistoryPage({ params, searchParams }: PlayerHistoryPageProps) {
  const { tag: rawParam } = await params;
  const decoded = decodeURIComponent(rawParam);
  const normalizedTag = normalizeTag(decoded || '') || decoded || '';
  const resolvedSearchParams = await searchParams;
  const days = Number.parseInt(resolvedSearchParams?.days || '30', 10);

  const result = await fetchPlayerHistory(normalizedTag, Number.isFinite(days) ? days : 30);
  if (!result || !result.success) {
    notFound();
  }

  const { data, meta } = result;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
              <Clock className="h-4 w-4 text-clash-gold" />
              Player history
            </div>
            <h1 className="text-3xl font-semibold text-white">{meta.playerName}</h1>
            <p className="text-sm text-slate-400">
              {meta.playerTag} · Last {meta.days} days · {meta.dataPointsFound} data points
            </p>
          </div>
          <Link
            href={`/new/player/${encodeURIComponent(normalizedTag)}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-200 hover:border-white/30"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to profile
          </Link>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Trophies">
          <TrophyChart data={data} />
        </Card>
        <Card title="Donations">
          <DonationChart data={data} />
        </Card>
      </div>

      <Card title="Hero upgrades">
        <HeroUpgradeHistory data={data} />
      </Card>

      <Card>
        <div className="text-xs text-slate-400">
          Data source: <span className="text-slate-200">{meta.dataSource}</span>
          {meta.includeDeltas ? ' · Delta calculations enabled' : ''}
        </div>
      </Card>
    </div>
  );
}
