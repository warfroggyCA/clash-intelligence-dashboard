"use client";

import { useMemo } from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import {
  calculateRushPercentage,
  calculateDonationBalance,
  getTownHallLevel,
} from '@/lib/business/calculations';

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

    const topBalances = members
      .map((member) => ({
        member,
        balance: calculateDonationBalance(member).balance,
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)
      .map((item) => ({
        name: item.member.name,
        value: `${item.balance >= 0 ? '+' : ''}${item.balance.toLocaleString('en-US')}`,
        subtitle: `${(item.member.donations || 0).toLocaleString('en-US')} donated`
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
        title: 'Best Donation Balance',
        entries: topBalances,
      },
    ].filter((section) => section.entries.length > 0);
  }, [roster]);

  if (!sections.length) {
    return (
      <aside className={`rounded-xl border border-slate-200 bg-white/90 backdrop-blur p-5 shadow-sm text-xs text-slate-500 ${className}`}>
        No highlight data available yet.
      </aside>
    );
  }

  return (
    <aside className={`rounded-xl border border-slate-200 bg-white/90 backdrop-blur p-5 shadow-sm space-y-4 ${className}`}>
      <div className="text-sm font-semibold text-slate-800">Clan Highlights</div>
      <div className="grid gap-4 lg:grid-cols-3">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
              {section.title}
            </div>
            <div className="space-y-2">
              {section.entries.map((entry) => (
                <div
                  key={`${section.title}-${entry.name}`}
                  className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm"
                >
                  <div className="flex items-center justify-between text-sm font-medium text-slate-800">
                    <span className="truncate pr-2">{entry.name}</span>
                    <span className="text-indigo-600">{entry.value}</span>
                  </div>
                  {entry.subtitle && (
                    <div className="text-xs text-slate-500">{entry.subtitle}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default RosterHighlightsPanel;
