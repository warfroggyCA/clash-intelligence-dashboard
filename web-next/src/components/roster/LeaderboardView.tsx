/**
 * Leaderboard View Component
 * 
 * Displays ranked leaderboards for multiple criteria with:
 * - Rank indicators
 * - Percentile badges
 * - "Your Rank" highlighting
 * - Top performer badges
 */

"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Trophy, Award, Medal, TrendingUp, Target, Heart, Zap } from 'lucide-react';
import { TownHallBadge, LeagueBadge } from '@/components/ui';
import { normalizeTag } from '@/lib/tags';
import type { RosterMember } from '@/app/(dashboard)/simple-roster/roster-transform';
import {
  getRankedMembers,
  getPlayerRank,
  formatLeaderboardValue,
  getCriteriaName,
  getCriteriaDescription,
  type LeaderboardCriteria,
  type RankedMember,
} from '@/lib/leaderboard-calculations';

interface LeaderboardViewProps {
  members: RosterMember[];
  currentPlayerTag?: string | null;
  className?: string;
}

const CRITERIA_ICONS: Record<LeaderboardCriteria, React.ReactNode> = {
  'vip': <Trophy className="h-4 w-4" />,
  'donation-ratio': <Heart className="h-4 w-4" />,
  'war-performance': <Target className="h-4 w-4" />,
  'capital': <Medal className="h-4 w-4" />,
  'activity': <Zap className="h-4 w-4" />,
  'donations-given': <Heart className="h-4 w-4" />,
  'war-stars': <Award className="h-4 w-4" />,
};

const ALL_CRITERIA: LeaderboardCriteria[] = [
  'vip',
  'donation-ratio',
  'war-performance',
  'capital',
  'activity',
  'donations-given',
  'war-stars',
];

export default function LeaderboardView({
  members,
  currentPlayerTag,
  className = '',
}: LeaderboardViewProps) {
  const [selectedCriteria, setSelectedCriteria] = React.useState<LeaderboardCriteria>('vip');

  const rankedMembers = useMemo(
    () => getRankedMembers(members, selectedCriteria),
    [members, selectedCriteria]
  );

  const currentPlayerRank = useMemo(() => {
    if (!currentPlayerTag) return null;
    return getPlayerRank(members, currentPlayerTag, selectedCriteria);
  }, [members, currentPlayerTag, selectedCriteria]);

  const formatRankDisplay = (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getBadgeClass = (badge: RankedMember['badge']): string => {
    switch (badge) {
      case 'top-1':
        return 'bg-clash-gold/10 border-clash-gold/40 text-clash-gold';
      case 'top-3':
        return 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300';
      case 'top-10':
        return 'bg-slate-600/20 border-slate-500/40 text-slate-300';
      default:
        return '';
    }
  };

  const isCurrentPlayer = (member: RankedMember): boolean => {
    if (!currentPlayerTag) return false;
    const normalizedCurrent = normalizeTag(currentPlayerTag);
    const normalizedMember = normalizeTag(member.tag);
    return normalizedCurrent === normalizedMember;
  };

  return (
    <div className={className}>
      {/* Criteria Selection Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-700/50 pb-4">
        {ALL_CRITERIA.map((criteria) => {
          const isSelected = selectedCriteria === criteria;
          return (
            <button
              key={criteria}
              onClick={() => setSelectedCriteria(criteria)}
              className={`
                flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all
                ${isSelected
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                }
              `}
              title={getCriteriaDescription(criteria)}
            >
              {CRITERIA_ICONS[criteria]}
              <span>{getCriteriaName(criteria)}</span>
            </button>
          );
        })}
      </div>

      {/* Current Player Rank Banner */}
      {currentPlayerRank && (
        <div className="mb-6 rounded-xl border border-indigo-500/50 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1">Your Rank</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">
                  {formatRankDisplay(currentPlayerRank.rank)}
                </span>
                <span className="text-sm text-slate-300">
                  of {rankedMembers.length} ({currentPlayerRank.percentile}th percentile)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {getCriteriaName(selectedCriteria)}: {formatLeaderboardValue(currentPlayerRank.value, selectedCriteria)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  TH
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  League
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {getCriteriaName(selectedCriteria)}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Percentile
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {rankedMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No data available for this criteria
                  </td>
                </tr>
              ) : (
                rankedMembers.map((member, index) => {
                  const isCurrent = isCurrentPlayer(member);
                  return (
                    <tr
                      key={member.tag}
                      className={`
                        transition-colors
                        ${isCurrent ? 'bg-indigo-600/20 border-l-2 border-indigo-500' : 'hover:bg-slate-800/30'}
                      `}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`
                            font-bold leading-none ${isCurrent ? 'text-indigo-300' : 'text-slate-300'}
                            ${member.rank <= 3 ? 'text-2xl' : 'text-sm'}
                          `}>
                            {formatRankDisplay(member.rank)}
                          </span>
                          {isCurrent && (
                            <span className="text-xs text-indigo-400 font-medium">(You)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/player/${member.tag.replace('#', '')}`}
                          className="text-white hover:text-slate-200 hover:underline transition-colors"
                          style={{ fontFamily: "'Clash Display', sans-serif" }}
                        >
                          {member.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <TownHallBadge
                            level={member.townHallLevel ?? 0}
                            size="sm"
                            showLevel
                            showBox={false}
                            levelBadgeClassName="rounded-full border-0 bg-slate-950/95 px-1.5 text-sm font-bold text-brand-text-primary shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          {(member.rankedLeagueName || member.leagueName) ? (
                            <div className="cursor-help">
                              <LeagueBadge
                                league={member.rankedLeagueName || member.leagueName || undefined}
                                trophies={member.trophies}
                                size="sm"
                                showText={false}
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold ${isCurrent ? 'text-indigo-300' : 'text-slate-100'}`}>
                          {formatLeaderboardValue(member.value, selectedCriteria)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-slate-400">
                          {member.percentile}th
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Footer */}
      <div className="mt-4 text-xs text-slate-500 text-center">
        <p>{getCriteriaDescription(selectedCriteria)}</p>
      </div>
    </div>
  );
}

