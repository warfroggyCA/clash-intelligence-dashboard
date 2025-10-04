"use client";

import { useMemo, useState } from 'react';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCcw, ChevronDown, ChevronUp, Users, Shield, Trophy, Heart, Swords } from 'lucide-react';
import { GlassCard, Button } from '@/components/ui';
import { calculateClanHealth, getTopPerformers, generateWatchlist, calculateMomentum, getElderPromotionCandidates, type Member } from '@/lib/clan-metrics';
import { generateAlerts, type Alert } from '@/lib/alerts-engine';
import { calculateWarMetrics, getTopWarPerformers, getMembersNeedingCoaching, type WarData } from '@/lib/war-metrics';
import { formatDistanceToNow } from 'date-fns';
import ElderPromotionPanel from './command-center/ElderPromotionPanel';
import WatchlistManager from './command-center/WatchlistManager';
import CommandCenterSettings, { type AlertThresholds } from './command-center/CommandCenterSettings';

interface CommandCenterProps {
  clanData: any;
  clanTag: string;
}

export default function CommandCenter({ clanData, clanTag }: CommandCenterProps) {
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const dataAgeHours = useDashboardStore(selectors.dataAge);

  const members: Member[] = useMemo(() => {
    return clanData?.members || [];
  }, [clanData]);

  const warData: WarData | undefined = useMemo(() => {
    return clanData?.snapshotDetails ? {
      currentWar: clanData.snapshotDetails.currentWar,
      warLog: clanData.snapshotDetails.warLog
    } : undefined;
  }, [clanData]);

  const clanHealth = useMemo(() => calculateClanHealth(members), [members]);
  const warMetrics = useMemo(() => calculateWarMetrics(members, warData), [members, warData]);
  const alerts = useMemo(() => generateAlerts(members, warData), [members, warData]);
  const topPerformers = useMemo(() => getTopPerformers(members, 3), [members]);
  const watchlist = useMemo(() => generateWatchlist(members), [members]);
  const momentum = useMemo(() => calculateMomentum(members), [members]);
  const elderCandidates = useMemo(() => getElderPromotionCandidates(members), [members]);
  const topWarPerformers = useMemo(() => getTopWarPerformers(warMetrics.memberPerformance, 5), [warMetrics.memberPerformance]);
  const membersNeedingWarCoaching = useMemo(() => getMembersNeedingCoaching(warMetrics.memberPerformance), [warMetrics.memberPerformance]);

  const dataFreshnessLabel = useMemo(() => {
    if (!snapshotMetadata?.fetchedAt) return 'Unknown';
    try {
      return formatDistanceToNow(new Date(snapshotMetadata.fetchedAt), { addSuffix: true });
    } catch (error) {
      return 'Unknown';
    }
  }, [snapshotMetadata?.fetchedAt]);

  const freshnessColor = useMemo(() => {
    if (dataAgeHours == null) return 'text-slate-400';
    if (dataAgeHours <= 6) return 'text-emerald-400';
    if (dataAgeHours <= 24) return 'text-green-400';
    if (dataAgeHours <= 48) return 'text-amber-400';
    return 'text-red-400';
  }, [dataAgeHours]);

  const highPriorityAlerts = alerts.filter(a => a.priority === 'high');
  const mediumPriorityAlerts = alerts.filter(a => a.priority === 'medium');
  const lowPriorityAlerts = alerts.filter(a => a.priority === 'low');

  const displayedAlerts = showAllAlerts ? alerts : alerts.slice(0, 5);

  if (!clanData || members.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 mx-auto mb-4 text-slate-400" />
        <p className="text-slate-300 text-lg">Load clan data to view Command Center</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard className="border-l-4 border-l-blue-500">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-100">🎯 Command Center</h1>
            </div>
            <p className="text-sm text-slate-400">Real-time intelligence for {clanData.clanName || 'your clan'}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm mb-1">
              <span className="text-slate-400">Data Freshness:</span>
              <span className={`font-semibold ${freshnessColor}`}>
                Updated {dataFreshnessLabel}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              {members.length} members tracked
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Critical Alerts */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Critical Alerts
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-red-400 font-semibold">{highPriorityAlerts.length} High</span>
            <span className="text-amber-400 font-semibold">{mediumPriorityAlerts.length} Medium</span>
            <span className="text-slate-400">{lowPriorityAlerts.length} Low</span>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No alerts detected. Clan is operating smoothly! 🎉</p>
          </div>
        ) : (
          <div id="alerts-list" className="space-y-3">
            {displayedAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                isExpanded={expandedAlert === alert.id}
                onToggle={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                members={members}
              />
            ))}

            {alerts.length > 5 && (
              <button
                onClick={() => setShowAllAlerts(!showAllAlerts)}
                className="w-full py-2 min-h-[44px] text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1 focus-ring"
                aria-expanded={showAllAlerts}
                aria-controls="alerts-list"
                aria-label={showAllAlerts 
                  ? `Collapse alerts list. Currently showing all ${alerts.length} alerts.` 
                  : `Expand to show all ${alerts.length} alerts. Currently showing 5.`
                }
              >
                {showAllAlerts ? (
                  <>
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                    Show All {alerts.length} Alerts
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </GlassCard>

      {/* Clan Health Metrics */}
      <GlassCard>
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-400" />
          Clan Health Metrics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Activity Score"
            value={`${clanHealth.activityScore}/100`}
            trend={clanHealth.activityScore >= 70 ? 'up' : clanHealth.activityScore >= 50 ? 'flat' : 'down'}
            description={`${clanHealth.membershipHealth.active}/${members.length} active (last 3 days)`}
          />

          <MetricCard
            label="Donation Balance"
            value={`${Math.round((clanHealth.donationBalance.healthy / members.length) * 100)}%`}
            trend={clanHealth.donationBalance.healthy / members.length >= 0.7 ? 'up' : 'flat'}
            description={`${clanHealth.donationBalance.healthy} healthy, ${clanHealth.donationBalance.netReceivers} net receivers`}
          />

          <MetricCard
            label="Rush Index"
            value={`${clanHealth.rushIndex}%`}
            trend={clanHealth.rushIndex <= 15 ? 'up' : clanHealth.rushIndex <= 30 ? 'flat' : 'down'}
            description="TH13+ bases with hero deficits"
          />

          <MetricCard
            label="At-Risk Members"
            value={clanHealth.membershipHealth.atRisk}
            trend={clanHealth.membershipHealth.atRisk === 0 ? 'up' : clanHealth.membershipHealth.atRisk <= 2 ? 'flat' : 'down'}
            description="3-7 days inactive"
          />
        </div>
      </GlassCard>

      {/* War Performance */}
      <GlassCard>
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Swords className="w-5 h-5 text-orange-400" />
          War Performance
        </h2>

        {/* Current War Status */}
        {warMetrics.currentWar.active ? (
          <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-orange-400">⚔️ WAR ACTIVE</span>
                {warMetrics.currentWar.state === 'preparation' && (
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">Preparation</span>
                )}
                {warMetrics.currentWar.state === 'inWar' && (
                  <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">Battle Day</span>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-300">vs {warMetrics.currentWar.opponent}</p>
                <p className="text-xs text-slate-400">{warMetrics.currentWar.teamSize}v{warMetrics.currentWar.teamSize}</p>
              </div>
            </div>
            {warMetrics.currentWar.timeRemaining && (
              <p className="text-sm text-slate-300 mt-2">{warMetrics.currentWar.timeRemaining}</p>
            )}
          </div>
        ) : (
          <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-center">
            <p className="text-sm text-slate-400">No active war</p>
          </div>
        )}

        {/* Recent War Record */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <MetricCard
            label="Last 10 Wars"
            value={`${warMetrics.recentPerformance.last10Wars.wins}W-${warMetrics.recentPerformance.last10Wars.losses}L`}
            trend={warMetrics.recentPerformance.trend === 'improving' ? 'up' : warMetrics.recentPerformance.trend === 'declining' ? 'down' : 'flat'}
            description={`${warMetrics.recentPerformance.last10Wars.draws} draws`}
          />

          <MetricCard
            label="Win Rate"
            value={`${warMetrics.recentPerformance.last10Wars.winRate}%`}
            trend={warMetrics.recentPerformance.last10Wars.winRate >= 60 ? 'up' : warMetrics.recentPerformance.last10Wars.winRate >= 40 ? 'flat' : 'down'}
            description={warMetrics.recentPerformance.trend === 'improving' ? '↗️ Improving' : warMetrics.recentPerformance.trend === 'declining' ? '↘️ Declining' : '→ Stable'}
          />

          <MetricCard
            label="Performance Trend"
            value={warMetrics.recentPerformance.trend.charAt(0).toUpperCase() + warMetrics.recentPerformance.trend.slice(1)}
            trend={warMetrics.recentPerformance.trend === 'improving' ? 'up' : warMetrics.recentPerformance.trend === 'declining' ? 'down' : 'flat'}
            description="Based on last 10 wars"
          />
        </div>

        {/* Top War Performers */}
        {warMetrics.memberPerformance.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Top War Performers (Est. Stars/Attack)</h3>
            <div className="space-y-2">
              {topWarPerformers.map((performer) => (
                <div
                  key={performer.tag}
                  className="flex items-center justify-between p-2 bg-emerald-500/10 border border-emerald-500/30 rounded"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{performer.name}</p>
                    <p className="text-xs text-slate-400">
                      {performer.warStars} stars • {performer.estimatedAttacks} attacks
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-400">{performer.estimatedStarsPerAttack.toFixed(2)}</p>
                    <p className="text-xs text-slate-400">stars/attack</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members Needing Coaching */}
        {membersNeedingWarCoaching.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Needs War Coaching ({membersNeedingWarCoaching.length})</h3>
            <div className="space-y-2">
              {membersNeedingWarCoaching.slice(0, 5).map((performer) => (
                <div
                  key={performer.tag}
                  className="flex items-center justify-between p-2 bg-red-500/10 border border-red-500/30 rounded"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{performer.name}</p>
                    <p className="text-xs text-slate-400">
                      {performer.warStars} stars • {performer.estimatedAttacks} attacks
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-400">{performer.estimatedStarsPerAttack.toFixed(2)}</p>
                    <p className="text-xs text-slate-400">stars/attack</p>
                  </div>
                </div>
              ))}
              {membersNeedingWarCoaching.length > 5 && (
                <p className="text-xs text-slate-500 text-center">+{membersNeedingWarCoaching.length - 5} more</p>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Top Performers & Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <GlassCard>
          <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Top Performers
          </h2>

          {topPerformers.length === 0 ? (
            <p className="text-sm text-slate-400">No standout performers this period</p>
          ) : (
            <div className="space-y-3">
              {topPerformers.slice(0, 5).map((performer) => (
                <div
                  key={`${performer.tag}-${performer.category}`}
                  className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
                >
                  <div>
                    <p className="font-semibold text-slate-100">{performer.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{performer.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-400">{performer.highlight}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Watchlist */}
        <GlassCard>
          <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Watchlist
          </h2>

          {watchlist.length === 0 ? (
            <p className="text-sm text-slate-400">No members require immediate attention</p>
          ) : (
            <div className="space-y-3">
              {watchlist.slice(0, 5).map((member) => (
                <div
                  key={member.tag}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    member.severity === 'high'
                      ? 'bg-red-500/10 border-red-500/30'
                      : member.severity === 'medium'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-slate-500/10 border-slate-500/30'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-slate-100">{member.name}</p>
                    <p className="text-xs text-slate-400">{member.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">{member.metric}</p>
                  </div>
                </div>
              ))}
              {watchlist.length > 5 && (
                <p className="text-xs text-slate-500 text-center">+{watchlist.length - 5} more</p>
              )}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Momentum Indicators */}
      <GlassCard>
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          📈 Momentum Indicators
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {momentum.map((indicator) => (
            <div
              key={indicator.category}
              className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-300">{indicator.label}</p>
                {indicator.trend === 'up' ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : indicator.trend === 'down' ? (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                ) : (
                  <Minus className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <p className="text-xs text-slate-400">{indicator.description}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Elder Promotion Candidates */}
      {elderCandidates.length > 0 && (
        <GlassCard>
          <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Elder Promotion Candidates
          </h2>

          <div className="space-y-3">
            {elderCandidates.map((candidate) => (
              <div
                key={candidate.tag}
                className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg"
              >
                <div>
                  <p className="font-semibold text-slate-100">{candidate.name}</p>
                  <p className="text-xs text-slate-400">
                    {candidate.donations} donations • Last seen {typeof candidate.lastSeen === 'number' ? candidate.lastSeen : 0} days ago
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    {candidate.tenure_days || candidate.tenure || 0} days in clan
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Elder Promotion Panel */}
      <ElderPromotionPanel candidates={elderCandidates} />

      {/* Watchlist Manager */}
      <WatchlistManager 
        watchlist={watchlist.map(item => ({
          member: item.member,
          reason: item.reason,
          severity: item.severity as 'high' | 'medium' | 'low',
        }))} 
      />

      {/* Command Center Settings */}
      <CommandCenterSettings
        onSave={(newThresholds) => setThresholds(newThresholds)}
        initialThresholds={thresholds || undefined}
      />
    </div>
  );
}

// Alert Card Component
function AlertCard({ 
  alert, 
  isExpanded, 
  onToggle,
  members 
}: { 
  alert: Alert; 
  isExpanded: boolean; 
  onToggle: () => void;
  members: Member[];
}) {
  const priorityColors = {
    high: 'bg-red-500/10 border-red-500/40',
    medium: 'bg-amber-500/10 border-amber-500/40',
    low: 'bg-slate-500/10 border-slate-500/40'
  };

  const priorityTextColors = {
    high: 'text-red-400',
    medium: 'text-amber-400',
    low: 'text-slate-400'
  };

  // Helper to get member name from tag
  const getMemberName = (tag: string): string => {
    const member = members.find(m => m.tag === tag);
    return member?.name || tag;
  };

  return (
    <div className={`border rounded-lg ${priorityColors[alert.priority]}`}>
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs uppercase font-semibold ${priorityTextColors[alert.priority]}`}>
                {alert.priority}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-500 capitalize">{alert.category}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-100 mb-1">{alert.title}</h3>
            <p className="text-xs text-slate-400">{alert.description}</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400 ml-2" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 ml-2" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 mt-1">
          <div className="space-y-2">
            <div>
              <p className="text-xs text-slate-500 mb-1">Recommended Action:</p>
              <p className="text-sm text-slate-200">{alert.actionable}</p>
            </div>

            {alert.affectedMembers.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1">
                  Affected Members ({alert.affectedMembers.length}):
                </p>
                <div className="flex flex-wrap gap-1">
                  {alert.affectedMembers.slice(0, 10).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-slate-700/50 px-2 py-1 rounded text-slate-300"
                    >
                      {getMemberName(tag)}
                    </span>
                  ))}
                  {alert.affectedMembers.length > 10 && (
                    <span className="text-xs text-slate-500 px-2 py-1">
                      +{alert.affectedMembers.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {alert.metric && (
              <div>
                <p className="text-xs text-slate-500">Metric: {alert.metric}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Metric Card Component
function MetricCard({
  label,
  value,
  trend,
  description
}: {
  label: string;
  value: string | number;
  trend: 'up' | 'down' | 'flat';
  description?: string;
}) {
  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    flat: 'text-slate-400'
  };

  return (
    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        {trend === 'up' ? (
          <TrendingUp className={`w-4 h-4 ${trendColors[trend]}`} />
        ) : trend === 'down' ? (
          <TrendingDown className={`w-4 h-4 ${trendColors[trend]}`} />
        ) : (
          <Minus className={`w-4 h-4 ${trendColors[trend]}`} />
        )}
      </div>
      <p className="text-2xl font-bold text-slate-100 mb-1">{value}</p>
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </div>
  );
}
