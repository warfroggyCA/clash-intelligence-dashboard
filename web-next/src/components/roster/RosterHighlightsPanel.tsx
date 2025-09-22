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
        value: item.donations.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
        subtitle: `Received ${(item.member.donationsReceived || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
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
        value: item.totalHeroes.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
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

  const panelClassName = ['min-h-[18rem]', className].filter(Boolean).join(' ');

  if (!sections.length) {
    return (
      <GlassCard className={`${panelClassName} flex`}>
        <div className="flex-1 rounded-xl border border-white/20 bg-white/15 px-4 py-6 text-center text-sm text-white/90 font-medium">
          No highlights available yet.
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className={`${panelClassName} flex flex-col`}>
      <div className="max-h-72 flex-1 space-y-6 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title} className="space-y-4">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 shadow-lg drop-shadow-md">
                  <Image
                    src={section.title.includes('Donator') ? '/assets/icons/donation.svg'
                      : section.title.includes('Hero') ? '/assets/icons/hero.svg'
                      : '/assets/icons/trophy.svg'}
                    alt=""
                    width={20}
                    height={20}
                    className="drop-shadow-sm"
                  />
                </div>
                <span className="drop-shadow-sm" style={{ color: '#FFFFFF', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{section.title}</span>
              </div>
              <div className="space-y-3">
                {section.entries.slice(0, 3).map((entry) => (
                  <div
                    key={`${section.title}-${entry.name}`}
                    className="rounded-xl border border-white/30 bg-gradient-to-r from-white/20 via-white/10 to-white/20 px-4 py-3 shadow-md backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span className="truncate pr-3 text-sm drop-shadow-sm" style={{ color: '#FFFFFF', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{entry.name}</span>
                      <span className="text-sm text-amber-100 font-bold drop-shadow-sm" style={{ color: '#FCD34D', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{entry.value}</span>
                    </div>
                    {entry.subtitle && (
                      <div className="mt-2 text-xs text-white/80 drop-shadow-sm" style={{ color: '#E2E8F0', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{entry.subtitle}</div>
                    )}
                  </div>
                ))}
                {section.entries.length > 3 && (
                  <div className="py-2 text-center text-xs text-white/60 font-medium" style={{ color: '#94A3B8', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
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
