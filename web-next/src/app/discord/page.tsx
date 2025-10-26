"use client";

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useShallow } from 'zustand/react/shallow';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import type { Roster } from '@/types';

const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });
const DiscordHub = dynamic(() => import('@/components/DiscordHub'), { ssr: false });

export default function DiscordPage() {
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '');
  const roster = useDashboardStore(useShallow((state) => state.roster)) as Roster | null;
  const clanName = roster?.clanName ?? roster?.meta?.clanName ?? null;
  const setActiveTab = useDashboardStore((state) => state.setActiveTab);

  useEffect(() => {
    setActiveTab('discord');
  }, [setActiveTab]);

  return (
    <DashboardLayout clanName={clanName || undefined}>
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <DiscordHub clanTag={clanTag} clanName={clanName ?? null} roster={roster} />
      </div>
    </DashboardLayout>
  );
}
