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

  if (!sections.length) {
    return (
      <GlassCard
        className={mergedClassName}
        icon={<Award className="h-5 w-5" />}
        title="Clan Highlights"
        subtitle="We’ll surface standout performers as data arrives"
      >
        <div className="text-xs text-slate-400">No highlight data available yet.</div>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      className={mergedClassName}
      icon={<Award className="h-5 w-5" />}
      title="Clan Highlights"
      subtitle="Top performers across rush, donations, and hero power"
    >
      <div className="rounded-2xl bg-gradient-to-br from-slate-900/70 via-slate-900/48 to-slate-800/52 px-4 py-5 shadow-inner text-slate-100">
        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.title} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100/75">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12">
                  <Image
                    src={section.title.includes('Donator') ? '/assets/icons/donation.svg'
                      : section.title.includes('Hero') ? '/assets/icons/hero.svg'
                      : '/assets/icons/trophy.svg'}
                    alt=""
                    width={22}
                    height={22}
                  />
                </div>
                {section.title}
              </div>
              <div className="space-y-2">
                {section.entries.map((entry) => (
                  <div
                    key={`${section.title}-${entry.name}`}
                    className="rounded-2xl bg-gradient-to-r from-white/12 via-white/6 to-white/8 px-3.5 py-3 text-sm text-slate-100 shadow-[0_12px_28px_-20px_rgba(6,10,30,0.65)]"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="truncate pr-2">{entry.name}</span>
                      <span className="text-amber-200">{entry.value}</span>
                    </div>
                    {entry.subtitle && (
                      <div className="text-xs text-slate-200/75">{entry.subtitle}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
};

export default RosterHighlightsPanel;
