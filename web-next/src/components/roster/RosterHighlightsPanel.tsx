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
            const getSectionIcon = () => {
              if (section.title.includes('Donator')) return '💝';
              if (section.title.includes('Hero')) return '🦸';
              return '🏆';
            };

            const getSectionColor = () => {
              if (section.title.includes('Donator')) return {
                bg: 'bg-emerald-50 dark:bg-emerald-950/20',
                border: 'border-emerald-200 dark:border-emerald-800',
                icon: 'bg-emerald-100 dark:bg-emerald-900/30',
                text: 'text-emerald-600 dark:text-emerald-400'
              };
              if (section.title.includes('Hero')) return {
                bg: 'bg-purple-50 dark:bg-purple-950/20',
                border: 'border-purple-200 dark:border-purple-800',
                icon: 'bg-purple-100 dark:bg-purple-900/30',
                text: 'text-purple-600 dark:text-purple-400'
              };
              return {
                bg: 'bg-amber-50 dark:bg-amber-950/20',
                border: 'border-amber-200 dark:border-amber-800',
                icon: 'bg-amber-100 dark:bg-amber-900/30',
                text: 'text-amber-600 dark:text-amber-400'
              };
            };

            const colors = getSectionColor();

            return (
              <div key={section.title} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors.icon}`}>
                    <span className="text-lg">{getSectionIcon()}</span>
                  </div>
                        <h3 
                          className={`font-semibold ${colors.text} dark:!text-white`}
                          style={{
                            color: typeof window !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : undefined
                          }}
                        >
                          {section.title}
                        </h3>
                </div>
                <div className="space-y-3">
                  {section.entries.slice(0, 3).map((entry, index) => (
                    <div
                      key={`${section.title}-${entry.name}`}
                      className="group p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div 
                            className={`flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:!text-white`}
                            style={{
                              color: typeof window !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : undefined
                            }}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                                  <p 
                                    className="text-sm font-medium text-slate-800 dark:!text-white truncate"
                                    style={{
                                      color: typeof window !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : undefined
                                    }}
                                  >
                                    {entry.name}
                                  </p>
                            {entry.subtitle && (
                              <p 
                                className="text-xs text-slate-500 dark:!text-white truncate"
                                style={{
                                  color: typeof window !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : undefined
                                }}
                              >
                                {entry.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
                          {entry.value}
                        </div>
                      </div>
                    </div>
                  ))}
                  {section.entries.length > 3 && (
                    <div className="py-2 text-center">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                        +{section.entries.length - 3} more
                      </span>
                    </div>
                  )}
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
