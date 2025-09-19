"use client";

import { useMemo } from 'react';
import Image from 'next/image';
import { Award } from 'lucide-react';
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
  entries: HighlightEntry[];
}

interface RosterHighlightsPanelProps {
  className?: string;
}

export const RosterHighlightsPanel: React.FC<RosterHighlightsPanelProps> = ({ className = '' }) => {
  const mergedClassName = ['min-h-[18rem]', className].filter(Boolean).join(' ');
  const roster = useDashboardStore((state) => state.roster);

  const sections = useMemo<HighlightSection[]>(() => {
    if (!roster?.members?.length) {
      return [];
    }

    const members = roster.members;

    const leastRushed = members
      .map((member) => ({
        member,
        rush: calculateRushPercentage(member),
      }))
      .filter((item) => Number.isFinite(item.rush))
      .sort((a, b) => a.rush - b.rush)
      .slice(0, 5)
      .map((item) => ({
        name: item.member.name,
        value: `${Math.round(item.rush)}% rush`,
        subtitle: `TH ${getTownHallLevel(item.member)}`,
      }));

    const topDonators = members
      .map((member) => ({
        member,
        donations: member.donations || 0,
      }))
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
        entries: leastRushed,
      },
      {
        title: 'Top Donators',
        entries: topDonators,
      },
      {
        title: 'Hero Power Leaders',
        entries: heroLeaders,
      },
    ].filter((section) => section.entries.length > 0);
  }, [roster]);

  if (!roster) {
    return (
      <GlassCard className={mergedClassName}>
        <div className="rounded-xl bg-white/20 px-3 py-4 text-center text-sm text-white font-medium border border-white/30">
          Loading roster data...
        </div>
      </GlassCard>
    );
  }

  if (!sections.length) {
    return (
      <GlassCard className={mergedClassName}>
        <div className="rounded-xl bg-white/20 px-3 py-4 text-center text-sm text-white font-medium border border-white/30">
          No highlight data available yet.
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className={mergedClassName}>
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[20rem] overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,0.35)_transparent] [scrollbar-width:thin]">
          {sections.map((section) => (
            <div key={section.title} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-white">
                <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-white/90 shadow-sm">
                  <Image
                    src={section.title.includes('Donator') ? '/assets/icons/donation.svg'
                      : section.title.includes('Hero') ? '/assets/icons/hero.svg'
                      : '/assets/icons/trophy.svg'}
                    alt=""
                    width={16}
                    height={16}
                  />
                </div>
                {section.title}
              </div>
              <div className="space-y-2">
                {section.entries.slice(0, 3).map((entry) => (
                  <div
                    key={`${section.title}-${entry.name}`}
                    className="rounded-2xl bg-gradient-to-r from-white/20 via-white/10 to-white/20 px-3 py-2 text-xs text-white shadow-sm border border-white/30"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="truncate pr-2 text-white">{entry.name}</span>
                      <span className="text-white/80 font-bold">{entry.value}</span>
                    </div>
                    {entry.subtitle && (
                      <div className="text-xs text-white/80 font-medium">{entry.subtitle}</div>
                    )}
                  </div>
                ))}
                {section.entries.length > 3 && (
                  <div className="text-xs text-white/60 font-medium text-center">
                    +{section.entries.length - 3} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
};

export default RosterHighlightsPanel;
