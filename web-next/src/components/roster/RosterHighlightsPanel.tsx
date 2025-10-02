"use client";

import { useMemo, useState, useEffect } from 'react';
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
  const [mounted, setMounted] = useState(false);
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
        title: 'Top Hero Power',
        icon: '/assets/icons/hero.svg',
        entries: heroLeaders,
      },
    ].filter((section) => section.entries.length > 0);
  }, [roster]);

  const panelClassName = ['xl:min-h-[18rem]', className].filter(Boolean).join(' ');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !sections.length) {
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
      <div className="flex-1 space-y-6 overflow-visible pr-0 md:pr-1">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {sections.map((section) => {
            const colors = (() => {
              if (section.title.includes('Donator')) {
                return {
                  badge: 'bg-emerald-400/15 text-emerald-200',
                  accent: 'text-emerald-200',
                };
              }
              if (section.title.includes('Hero')) {
                return {
                  badge: 'bg-brand-primary/15 text-brand-primary',
                  accent: 'text-brand-primary',
                };
              }
              return {
                badge: 'bg-amber-400/15 text-amber-200',
                accent: 'text-amber-200',
              };
            })();

            return (
              <div key={section.title} className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">{section.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${colors.badge}`}>Top 5</span>
                </div>
                <div className="space-y-2">
                  {section.entries.map((entry, index) => (
                    <div
                      key={`${section.title}-${entry.name}`}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-brand-surfaceSubtle/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 text-sm">
                        <span className="text-xs font-semibold text-slate-500">{index + 1}.</span>
                        <span className="truncate font-medium text-slate-100">{entry.name}</span>
                      </div>
                      <span className={`${colors.accent} text-xs font-semibold`}>{entry.value}</span>
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
