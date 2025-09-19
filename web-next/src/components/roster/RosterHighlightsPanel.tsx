"use client";

import { useMemo } from 'react';
import Image from 'next/image';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import {
  calculateRushPercentage,
  getTownHallLevel,
} from '@/lib/business/calculations';
import { GlassCard } from '@/components/ui';

interface HighlightEntry {
  name: string;
  value: string;
  subtitle?: string;
}

interface HighlightSection {
  title: string;
  icon: string;
  entries: HighlightEntry[];
}

interface RosterHighlightsPanelProps {
  className?: string;
}

export const RosterHighlightsPanel: React.FC<RosterHighlightsPanelProps> = ({ className = '' }) => {
  const roster = useDashboardStore((state) => state.roster);

  const sections = useMemo<HighlightSection[]>(() => {
    if (!roster?.members?.length) {
      return [];
    }

    const members = roster.members;

    const leastRushed = members
      .map((member) => ({ member, rush: calculateRushPercentage(member) }))
      .filter((item) => Number.isFinite(item.rush))
      .sort((a, b) => a.rush - b.rush)
      .slice(0, 5)
      .map((item) => ({
        name: item.member.name,
        value: `${Math.round(item.rush)}% rush`,
        subtitle: `TH ${getTownHallLevel(item.member)}`,
      }));

    const topDonators = members
      .map((member) => ({ member, donations: member.donations || 0 }))
      .filter((item) => item.donations > 0)
      .sort((a, b) => b.donations - a.donations)
      .slice(0, 5)
      .map((item) => ({
        name: item.member.name,
        value: item.donations.toLocaleString('en-US'),
        subtitle: `Received ${(item.member.donationsReceived || 0).toLocaleString('en-US')}`,
      }));

    const heroLeaders = members
      .map((member) => ({
        member,
        totalHeroes:
          (member.bk || 0) +
          (member.aq || 0) +
          (member.gw || 0) +
          (member.rc || 0) +
          (member.mp || 0),
      }))
      .filter((entry) => entry.totalHeroes > 0)
      .sort((a, b) => b.totalHeroes - a.totalHeroes)
      .slice(0, 5)
      .map((item) => ({
        name: item.member.name,
        value: item.totalHeroes.toLocaleString('en-US'),
        subtitle: `BK ${item.member.bk || 0} • AQ ${item.member.aq || 0} • GW ${item.member.gw || 0}`,
      }));

    return [
      {
        title: 'Least Rushed Bases',
        icon: '/assets/icons/trophy.svg',
        entries: leastRushed,
      },
      {
        title: 'Top Donators',
        icon: '/assets/icons/donation.svg',
        entries: topDonators,
      },
      {
        title: 'Hero Power Leaders',
        icon: '/assets/icons/hero.svg',
        entries: heroLeaders,
      },
    ].filter((section) => section.entries.length > 0);
  }, [roster]);

  return (
    <GlassCard className={['min-h-[18rem]', className].filter(Boolean).join(' ')}>
      {!sections.length ? (
        <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-4 text-center text-sm text-white/80">
          No highlights available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
          {sections.map((section) => (
            <div key={section.title} className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/75 shadow-sm">
                  <Image src={section.icon} alt="" width={18} height={18} />
                </div>
                <span>{section.title}</span>
              </div>
              <div className="space-y-2">
                {section.entries.slice(0, 3).map((entry) => (
                  <div
                    key={`${section.title}-${entry.name}`}
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2"
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span className="truncate pr-2 text-sm">{entry.name}</span>
                      <span className="text-xs text-amber-200 font-bold">{entry.value}</span>
                    </div>
                    {entry.subtitle && (
                      <div className="mt-1 text-[11px] text-white/70">{entry.subtitle}</div>
                    )}
                  </div>
                ))}
                {section.entries.length > 3 && (
                  <div className="py-1 text-center text-xs text-white/60">
                    +{section.entries.length - 3} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
};

export default RosterHighlightsPanel;
