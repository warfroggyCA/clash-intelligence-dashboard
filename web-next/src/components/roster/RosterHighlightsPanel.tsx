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
      }));

    const topDonators = members
      .map((member) => ({ member, donations: member.donations || 0 }))
      .filter((item) => item.donations > 0)
      .sort((a, b) => b.donations - a.donations)
      .slice(0, 5)
      .map((item) => ({
        name: item.member.name,
        value: item.donations.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
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

  const panelClassName = ['xl:min-h-[18rem]', className].filter(Boolean).join(' ');

  if (!sections.length) {
    return (
      <GlassCard className={`${panelClassName} flex`}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <span className="text-xl">⭐</span>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No highlights available yet</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className={`${panelClassName} flex flex-col`}>
      <div className="flex-1 space-y-6 overflow-visible pr-0 md:pr-1 xl:max-h-72 xl:overflow-y-auto">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {sections.map((section) => {
            const colors = (() => {
              if (section.title.includes('Donator')) return {
                bg: 'bg-emerald-50 dark:bg-emerald-950/15',
                border: 'border-emerald-200 dark:border-emerald-800/40',
                text: 'text-emerald-600 dark:text-emerald-300'
              };
              if (section.title.includes('Hero')) return {
                bg: 'bg-purple-50 dark:bg-purple-950/15',
                border: 'border-purple-200 dark:border-purple-800/40',
                text: 'text-purple-600 dark:text-purple-300'
              };
              return {
                bg: 'bg-amber-50 dark:bg-amber-950/15',
                border: 'border-amber-200 dark:border-amber-800/40',
                text: 'text-amber-600 dark:text-amber-300'
              };
            })();

            return (
              <div key={section.title} className="space-y-4">
                <h3
                  className={`text-sm font-semibold uppercase tracking-[0.2em] ${colors.text}`}
                >
                  {section.title}
                </h3>
                <div className="space-y-2">
                  {section.entries.map((entry, index) => (
                    <div
                      key={`${section.title}-${entry.name}`}
                      className="clash-highlight-entry flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 text-sm">
                        <span className="text-xs font-semibold text-slate-500 dark:text-white/50">{index + 1}.</span>
                        <span className="truncate font-medium">{entry.name}</span>
                      </div>
                      <span className={`${colors.text} text-xs font-semibold`}
                      >
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
};

export default RosterHighlightsPanel;
