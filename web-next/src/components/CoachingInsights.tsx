"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Copy, MessageSquare, TrendingUp, Users, Shield, Trophy, Star, AlertTriangle, Send, RefreshCcw } from "lucide-react";
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { safeLocaleString } from '@/lib/date';
import type { SmartInsightsPayload, SmartInsightsRecommendation, SmartInsightsDiagnostics, SmartInsightsSource } from '@/lib/smart-insights';
import { SMART_INSIGHTS_SCHEMA_VERSION } from '@/lib/smart-insights';
import { normalizeTag } from '@/lib/tags';

// Import rush percentage calculation (simplified version)
const getTH = (m: any): number => m.townHallLevel ?? m.th ?? 0;

type Caps = Partial<Record<"bk"|"aq"|"gw"|"rc"|"mp", number>>;

const rushPercent = (m: any, thCaps?: Map<number, Caps>): number => {
  const th = getTH(m) ?? 0; 
  const caps = thCaps?.get(th) || {};
  const keys: ("bk"|"aq"|"gw"|"rc"|"mp")[] = []; 
  for (const k of ["bk", "aq", "gw", "rc", "mp"] as const) {
    if (caps[k] && caps[k]! > 0) keys.push(k);
  }
  if (keys.length === 0) return 0;
  let total = 0;
  for (const k of keys) {
    const current = (m[k] ?? 0);
    const cap = caps[k]!;
    total += Math.max(0, cap - current) / cap;
  }
  return Math.round((total / keys.length) * 100);
};

const calculateThCaps = (members: any[]): Map<number, Caps> => {
  const caps = new Map<number, Caps>();
  for (const m of members) {
    const th = getTH(m); 
    if (th < 8) continue;
    const entry = caps.get(th) || {};
    for (const k of ["bk", "aq", "gw", "rc", "mp"] as const) {
      const v = m[k];
      if (typeof v === "number" && v > 0) {
        entry[k] = Math.max(entry[k] || 0, v);
      }
    }
    caps.set(th, entry);
  }
  return caps;
};

type CoachingCard = SmartInsightsRecommendation & {
  timestamp?: string;
  date?: string;
};

interface Member {
  name: string;
  tag: string;
  townHallLevel?: number | null;
  th?: number;
  bk?: number | null;
  aq?: number | null;
  gw?: number | null;
  rc?: number | null;
  mp?: number | null;
  trophies?: number;
  donations?: number;
  donationsReceived?: number;
  warStars?: number;
  tenure_days?: number;
  tenure?: number;
  lastSeen?: string | number;
  role?: string;
  recentClans?: string[];
}

interface Roster {
  source: "live" | "fallback" | "snapshot";
  date?: string;
  clanName?: string;
  members: Member[];
  meta?: any;
}

interface CoachingInsightsProps {
  clanData: Roster | null;
  clanTag: string;
}

export default function CoachingInsights({ clanData, clanTag }: CoachingInsightsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const setSmartInsights = useDashboardStore((state) => state.setSmartInsights);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [actionedTips, setActionedTips] = useState<Set<string>>(new Set());
  const [showActioned, setShowActioned] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string>("");
  const [isSharingToDiscord, setIsSharingToDiscord] = useState<string | null>(null);

  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const snapshotDetails = useDashboardStore(selectors.snapshotDetails);
  const snapshotAgeHours = useDashboardStore(selectors.dataAge);
  const smartInsights = useDashboardStore(selectors.smartInsights);
  const smartInsightsStatus = useDashboardStore(selectors.smartInsightsStatus);
  const smartInsightsError = useDashboardStore(selectors.smartInsightsError);
  const loadSmartInsights = useDashboardStore((state) => state.loadSmartInsights);

  const snapshotSummary = useMemo(() => {
    if (!snapshotMetadata) return '';
    const parts: string[] = [];
    parts.push(`Snapshot date: ${snapshotMetadata.snapshotDate}`);
    parts.push(`Fetched: ${safeLocaleString(snapshotMetadata.fetchedAt, {
      fallback: 'Unknown',
      context: 'CoachingInsights snapshotMetadata.fetchedAt'
    })}`);
    parts.push(`Members: ${snapshotMetadata.memberCount}`);
    if (snapshotAgeHours != null) {
      const freshness = snapshotAgeHours <= 24 ? 'Fresh (≤24h)' : snapshotAgeHours <= 48 ? 'Stale (24-48h)' : 'Outdated (>48h)';
      parts.push(`Freshness: ${freshness}`);
    }
    if (snapshotDetails?.currentWar) {
      const war = snapshotDetails.currentWar;
      const opponent = war.opponent ? `${war.opponent.name} (${war.opponent.tag})` : 'Unknown opponent';
      parts.push(`Current war: ${war.state || 'unknown'} vs ${opponent} • Team ${war.teamSize}${war.attacksPerMember ? ` x${war.attacksPerMember}` : ''}`);
      if (war.endTime) {
        parts.push(`War ends: ${safeLocaleString(war.endTime, {
          fallback: 'Unknown',
          context: 'CoachingInsights current war endTime'
        })}`);
      }
    }
    if (snapshotDetails?.warLog?.length) {
      const wins = snapshotDetails.warLog.filter((w) => w.result === 'WIN').length;
      parts.push(`Recent wars: ${wins} wins of ${snapshotDetails.warLog.length}`);
    }
    if (snapshotDetails?.capitalRaidSeasons?.length) {
      const latest = snapshotDetails.capitalRaidSeasons[0];
      parts.push(`Capital raid: Hall ${latest.capitalHallLevel} • ${latest.state || 'unknown'} • Off ${latest.offensiveLoot?.toLocaleString() ?? '0'} / Def ${latest.defensiveLoot?.toLocaleString() ?? '0'}`);
    }
    return parts.join('\n');
  }, [snapshotMetadata, snapshotDetails, snapshotAgeHours]);

  const mapPayloadToAdvice = useCallback((payload: SmartInsightsPayload): CoachingCard[] => {
    const generatedAt = payload.metadata.generatedAt;
    return (payload.coaching || []).map((entry) => ({
      ...entry,
      timestamp: generatedAt,
      date: payload.metadata.snapshotDate,
    }));
  }, []);

  const persistSmartInsightsPayload = useCallback((payload: SmartInsightsPayload, recommendations: CoachingCard[]) => {
    setSmartInsights(payload);
    try {
      localStorage.setItem(`coaching_advice_${clanTag}`, JSON.stringify(recommendations));
    } catch (storageError) {
      console.error('[Coaching Insights] Failed to persist coaching advice cache:', storageError);
    }
  }, [clanTag, setSmartInsights]);

  const createPayloadFromRecommendations = useCallback((
    recommendations: CoachingCard[],
    source: SmartInsightsSource,
    diagnosticsOverrides: Partial<SmartInsightsDiagnostics> = {}
  ): SmartInsightsPayload => {
    const generatedAt = new Date().toISOString();
    const snapshotDate = snapshotMetadata?.snapshotDate || generatedAt.slice(0, 10);
    const diagnostics: SmartInsightsDiagnostics = {
      openAIConfigured: diagnosticsOverrides.openAIConfigured ?? false,
      processingTimeMs: diagnosticsOverrides.processingTimeMs ?? 0,
      hasError: diagnosticsOverrides.hasError ?? false,
      changeSummary: diagnosticsOverrides.changeSummary ?? false,
      coaching: recommendations.length > 0,
      playerDNA: diagnosticsOverrides.playerDNA ?? false,
      clanDNA: diagnosticsOverrides.clanDNA ?? false,
      gameChat: diagnosticsOverrides.gameChat ?? false,
      performanceAnalysis: diagnosticsOverrides.performanceAnalysis ?? false,
      errorMessage: diagnosticsOverrides.errorMessage,
    };

    return {
      metadata: {
        clanTag,
        snapshotDate,
        generatedAt,
        source,
        schemaVersion: SMART_INSIGHTS_SCHEMA_VERSION,
        snapshotId: snapshotMetadata?.fetchedAt,
      },
      briefing: {
        title: "Today's Briefing",
        summary: recommendations.length
          ? `${recommendations.length} coaching recommendation${recommendations.length === 1 ? '' : 's'} ready.`
          : 'No automated highlights available yet.',
        sentiment: diagnostics.hasError ? 'warning' : (recommendations.length ? 'positive' : 'neutral'),
        highlights: [],
      },
      headlines: [],
      recognition: {
        playerOfTheDay: null,
        spotlights: [],
        watchlist: [],
        callouts: [],
      },
      coaching: recommendations.map(({ timestamp, date, ...rest }) => rest),
      playerSpotlights: [],
      playerOfTheDay: null,
      diagnostics,
      context: {
        changeSummary: undefined,
        performanceAnalysis: undefined,
        clanDNAInsights: undefined,
        gameChatMessages: undefined,
      },
    };
  }, [clanTag, snapshotMetadata?.snapshotDate, snapshotMetadata?.fetchedAt]);

  const attachTimestamps = useCallback((items: CoachingCard[]): CoachingCard[] => {
    const nowIso = new Date().toISOString();
    let today = 'Unknown Date';
    try {
      today = new Date().toLocaleDateString();
    } catch (error) {
      console.error('[Coaching Insights] Date formatting error while attaching timestamps:', error);
    }
    return items.map((item) => ({
      ...item,
      timestamp: item.timestamp || nowIso,
      date: item.date || today,
    }));
  }, []);

  const normalizedClanTag = useMemo(() => normalizeTag(clanTag) || clanTag, [clanTag]);
  const adviceFromInsights = useMemo(() => {
    if (!smartInsights) return [] as CoachingCard[];
    const payloadTag = normalizeTag(smartInsights.metadata.clanTag) || smartInsights.metadata.clanTag;
    if (payloadTag !== normalizedClanTag) return [] as CoachingCard[];
    return mapPayloadToAdvice(smartInsights);
  }, [mapPayloadToAdvice, normalizedClanTag, smartInsights]);

  const fallbackAdvice = useMemo(() => attachTimestamps([
    {
      id: 'setup-message',
      category: 'System',
      title: 'Coaching Insights Setup',
      description:
        'The coaching insights system is being set up. Your first batch of personalized guidance will be available after the nightly processing completes (usually within 24 hours). You can also generate insights manually using the button below.',
      priority: 'medium',
      icon: '🤖',
    },
  ]), [attachTimestamps]);

  const hasAdvice = adviceFromInsights.length > 0;
  const advice = hasAdvice ? adviceFromInsights : fallbackAdvice;
  const hasSmartInsightsError = Boolean(smartInsightsError);
  const isInitialLoading = smartInsightsStatus === 'loading' && !hasAdvice && !hasSmartInsightsError && !isGenerating;
  const isRefreshing = smartInsightsStatus === 'loading' && hasAdvice;
  const showSpinner = isGenerating || isInitialLoading;
  const isSetupMessage = !hasAdvice;

  useEffect(() => {
    if (!clanTag) return;
    loadSmartInsights(clanTag);
  }, [clanTag, loadSmartInsights]);

  useEffect(() => {
    // Load actioned tips from localStorage
    const saved = localStorage.getItem(`actioned_tips_${clanTag}`);
    if (saved) {
      try {
        setActionedTips(new Set(JSON.parse(saved)));
      } catch (error) {
        console.error('Failed to load actioned tips:', error);
      }
    }

    // Load Discord webhook URL from localStorage
    const savedWebhook = localStorage.getItem(`discord_webhook_${clanTag}`);
    if (savedWebhook) {
      setDiscordWebhookUrl(savedWebhook);
    }
  }, [clanTag]);

  const generateCoachingAdvice = async () => {
    if (!clanData?.members || clanData.members.length === 0) {
      return;
    }

    setIsGenerating(true);
    console.log('[Coaching Insights] Generating new coaching advice manually...');
    
    // Calculate contextual data for smarter coaching
    const thCaps = calculateThCaps(clanData.members);
    const totalDonations = clanData.members.reduce((sum, m) => sum + (m.donations || 0), 0);
    const avgDonations = totalDonations / clanData.members.length;
    
    try {
      const response = await fetch('/api/ai-coaching/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanData: {
            clanName: clanData.clanName,
            clanTag,
            memberCount: clanData.members.length,
            averageDonations: Math.round(avgDonations),
            members: clanData.members.map(member => {
              const rushPercentage = rushPercent(member, thCaps);
              const donationBalance = (member.donationsReceived || 0) - (member.donations || 0);
              const isNetReceiver = donationBalance > 0;
              const isLowDonator = (member.donations || 0) < avgDonations * 0.5;
              
              return {
                name: member.name,
                tag: member.tag,
                townHall: member.townHallLevel || member.th,
                role: member.role,
                trophies: member.trophies,
                donations: member.donations,
                donationsReceived: member.donationsReceived,
                donationBalance: donationBalance,
                tenure: member.tenure_days || member.tenure,
                lastSeen: member.lastSeen,
                rushPercentage: rushPercentage,
                isRushed: rushPercentage > 50,
                isVeryRushed: rushPercentage > 70,
                isNetReceiver: isNetReceiver,
                isLowDonator: isLowDonator,
                heroes: {
                  barbarianKing: member.bk,
                  archerQueen: member.aq,
                  grandWarden: member.gw,
                  royalChampion: member.rc,
                  minionPrince: member.mp
                }
              };
            })
          },
          snapshotMetadata,
          snapshotDetails,
          snapshotSummary,
        })
      });

      if (response.ok) {
        const result = await response.json();
        const rawAdvice = result?.data?.advice;
        const newAdvice: CoachingCard[] = Array.isArray(rawAdvice) ? rawAdvice : [];

        // Add timestamps to new advice
        const adviceWithTimestamps = newAdvice.map((item: CoachingCard) => ({
          ...item,
          timestamp: new Date().toISOString(),
          date: (() => {
            try {
              return new Date().toLocaleDateString();
            } catch (error) {
              console.error('Date formatting error in CoachingInsights:', error);
              return 'Unknown Date';
            }
          })()
        }));

        const payload = createPayloadFromRecommendations(adviceWithTimestamps, 'adhoc', {
          openAIConfigured: true,
        });
        persistSmartInsightsPayload(payload, adviceWithTimestamps);
      } else {
        // Fallback to local analysis if API fails
        const localAdvice = generateLocalAdvice();
        // Add timestamps to local advice
        const adviceWithTimestamps = localAdvice.map((item: CoachingCard) => ({
          ...item,
          timestamp: new Date().toISOString(),
          date: (() => {
            try {
              return new Date().toLocaleDateString();
            } catch (error) {
              console.error('Date formatting error in CoachingInsights:', error);
              return 'Unknown Date';
            }
          })()
        }));
        const payload = createPayloadFromRecommendations(adviceWithTimestamps, 'adhoc', {
          openAIConfigured: false,
          errorMessage: 'Fallback local advice',
        });
        persistSmartInsightsPayload(payload, adviceWithTimestamps);
      }
    } catch (error) {
      console.error('Failed to generate coaching insight request:', error);
      const localAdvice = attachTimestamps(generateLocalAdvice());
      const payload = createPayloadFromRecommendations(localAdvice, 'adhoc', {
        openAIConfigured: false,
        errorMessage: 'Local fallback after error',
      });
      persistSmartInsightsPayload(payload, localAdvice);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateLocalAdvice = (): CoachingCard[] => {
    if (!clanData?.members) return [];

    const advice: CoachingCard[] = [];
    const members = clanData.members;

    // Analyze donations with specific names
    const totalDonations = members.reduce((sum, m) => sum + (m.donations || 0), 0);
    const avgDonations = totalDonations / members.length;
    const topDonators = members.sort((a, b) => (b.donations || 0) - (a.donations || 0)).slice(0, 3);
    const lowDonators = members.filter(m => (m.donations || 0) < avgDonations * 0.5);
    
    if (topDonators.length > 0 && topDonators[0].donations && topDonators[0].donations > 0) {
      advice.push({
        id: `top-donator-${topDonators[0].tag}`,
        category: "Donations",
        title: `${topDonators[0].name} Leading Donations`,
        description: `${topDonators[0].name} is our top donator with ${topDonators[0].donations} donations this season!`,
        chatMessage: `Shoutout to ${topDonators[0].name} for being our top donator with ${topDonators[0].donations} donations! 🎉 You're setting a great example for the clan!`,
        priority: "medium",
        icon: "👑"
      });
    }

    if (lowDonators.length > 0 && lowDonators.length <= 5) {
      advice.push({
        id: `low-donators-${lowDonators.map(m => m.tag).join('-')}`,
        category: "Donations",
        title: `${lowDonators.map(m => m.name).join(', ')} Need More Donations`,
        description: `${lowDonators.map(m => m.name).join(', ')} are below the clan average of ${Math.round(avgDonations)} donations.`,
        chatMessage: `Hey ${lowDonators.map(m => m.name).join(', ')}! Let's step up our donation game! The clan average is ${Math.round(avgDonations)} - we believe in you! 💪`,
        priority: "high",
        icon: "📈"
      });
    }

    // Analyze inactive members with specific names
    const inactiveMembers = members.filter(m => 
      typeof m.lastSeen === "number" && m.lastSeen > 3
    );
    
    if (inactiveMembers.length > 0 && inactiveMembers.length <= 5) {
      advice.push({
        id: `inactive-members-${inactiveMembers.map(m => m.tag).join('-')}`,
        category: "Activity",
        title: `${inactiveMembers.map(m => m.name).join(', ')} Haven't Been Active`,
        description: `${inactiveMembers.map(m => `${m.name} (${m.lastSeen} days)`).join(', ')} haven't been seen recently.`,
        chatMessage: `Hey ${inactiveMembers.map(m => m.name).join(', ')}! We miss you! ${inactiveMembers.map(m => `${m.name} hasn't been seen in ${m.lastSeen} days`).join(', ')}. Hope everything's okay! 🤝`,
        priority: "high",
        icon: "⏰"
      });
    }

    // Analyze new members with specific names
    const newMembers = members.filter(m => 
      (m.tenure_days || m.tenure || 0) < 7
    );
    
    if (newMembers.length > 0 && newMembers.length <= 5) {
      advice.push({
        id: `new-members-${newMembers.map(m => m.tag).join('-')}`,
        category: "New Members",
        title: `Welcome ${newMembers.map(m => m.name).join(', ')}`,
        description: `${newMembers.map(m => m.name).join(', ')} joined the clan recently and need a warm welcome.`,
        chatMessage: `Welcome to the clan ${newMembers.map(m => m.name).join(', ')}! 🎉 We're excited to have you here. Don't hesitate to ask for troops or advice!`,
        priority: "high",
        icon: "🎉"
      });
    }

    // Analyze trophy achievements
    const highTrophyMembers = members.filter(m => (m.trophies || 0) > 2000);
    const lowTrophyMembers = members.filter(m => (m.trophies || 0) < 1000);
    
    if (highTrophyMembers.length > 0 && highTrophyMembers.length <= 3) {
      advice.push({
        id: `high-trophies-${highTrophyMembers.map(m => m.tag).join('-')}`,
        category: "Trophies",
        title: `${highTrophyMembers.map(m => m.name).join(', ')} in High Leagues`,
        description: `${highTrophyMembers.map(m => `${m.name} (${m.trophies} trophies)`).join(', ')} are in high trophy leagues!`,
        chatMessage: `Amazing work ${highTrophyMembers.map(m => m.name).join(', ')}! ${highTrophyMembers.map(m => `${m.name} is at ${m.trophies} trophies`).join(', ')} - you're inspiring the rest of us! 🏆`,
        priority: "medium",
        icon: "🏆"
      });
    }

    if (lowTrophyMembers.length > 0 && lowTrophyMembers.length <= 5) {
      advice.push({
        id: `low-trophies-${lowTrophyMembers.map(m => m.tag).join('-')}`,
        category: "Trophies",
        title: `${lowTrophyMembers.map(m => m.name).join(', ')} Trophy Push Opportunity`,
        description: `${lowTrophyMembers.map(m => `${m.name} (${m.trophies} trophies)`).join(', ')} are below 1000 trophies and could benefit from a push.`,
        chatMessage: `Hey ${lowTrophyMembers.map(m => m.name).join(', ')}! Let's get those trophies up! ${lowTrophyMembers.map(m => `${m.name} is at ${m.trophies}`).join(', ')} - we can help you climb! 📈`,
        priority: "medium",
        icon: "📈"
      });
    }

    return advice;
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessage(messageId);
      setTimeout(() => setCopiedMessage(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const markAsActioned = (tipId: string) => {
    const newActionedTips = new Set(actionedTips);
    newActionedTips.add(tipId);
    setActionedTips(newActionedTips);
    
    // Save to localStorage
    localStorage.setItem(`actioned_tips_${clanTag}`, JSON.stringify([...newActionedTips]));
  };

  const clearAllActioned = () => {
    setActionedTips(new Set());
    localStorage.removeItem(`actioned_tips_${clanTag}`);
  };

  const shareToDiscord = async (advice: CoachingCard, tipId: string) => {
    if (!discordWebhookUrl) {
      alert("Please configure your Discord webhook URL first! Go to the Discord tab to set it up.");
      return;
    }

    setIsSharingToDiscord(tipId);
    try {
      // Create Discord-friendly message with snapshot context
      const discordMessage = `🤖 **Coaching Insight**\n\n**${advice.title}**\n${advice.description}\n\n**Ready-to-paste message:**\n${advice.chatMessage}\n\n**Context:** ${snapshotSummary || 'No snapshot context available'}`;

      const response = await fetch('/api/discord/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookUrl: discordWebhookUrl,
          content: discordMessage,
          exhibitType: 'ai_coaching',
          clanTag: clanTag,
        }),
      });

      if (response.ok) {
        alert("coaching insight request shared to Discord successfully!");
      } else {
        const errorData = await response.json();
        alert(`Failed to share to Discord: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Discord share error:', error);
      alert("Failed to share to Discord. Please check your webhook URL.");
    } finally {
      setIsSharingToDiscord(null);
    }
  };

  const generateTipId = (tip: CoachingCard, index: number): string => {
    // Create a unique ID based on the tip content and clan data
    return `${clanTag}_${tip.category}_${tip.title}_${index}`.replace(/[^a-zA-Z0-9_]/g, '_');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "border-red-200 bg-red-50";
      case "medium": return "border-yellow-200 bg-yellow-50";
      case "low": return "border-green-200 bg-green-50";
      default: return "border-gray-200 bg-gray-50";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high": return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case "medium": return <TrendingUp className="w-5 h-5 text-yellow-600" />;
      case "low": return <Star className="w-5 h-5 text-green-600" />;
      default: return <MessageSquare className="w-5 h-5 text-gray-600" />;
    }
  };

  if (!clanData) {
    return (
      <div className="text-center py-8 text-gray-500">
        Load clan data first to get coaching insight request.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Coaching Insights</h2>
          <p className="text-sm text-gray-600 mt-1">Expert Clash of Clans advice and ready-to-paste chat messages</p>
          {advice.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {advice.filter((item, index) => !actionedTips.has(generateTipId(item, index))).length} active tips
              {actionedTips.size > 0 && ` • ${actionedTips.size} actioned`}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {actionedTips.size > 0 && (
            <>
              <button
                onClick={() => setShowActioned(!showActioned)}
                className={`px-3 py-1 rounded-lg text-sm ${
                  showActioned 
                    ? "bg-gray-200 text-gray-700" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {showActioned ? "Hide" : "Show"} Actioned ({actionedTips.size})
              </button>
              {showActioned && (
                <button
                  onClick={clearAllActioned}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                  title="Clear all actioned tips"
                >
                  🗑️ Clear All
                </button>
              )}
            </>
          )}
          <button
            onClick={generateCoachingAdvice}
            disabled={isGenerating || isInitialLoading}
            className={`px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all ${
              isSetupMessage
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white text-lg font-semibold shadow-lg"
                : "bg-purple-600 text-white"
            }`}
          >
            {isGenerating ? "🤖 Generating..." : isSetupMessage ? "🚀 Generate Your First Insights" : "🤖 Generate New Insights"}
          </button>
        </div>
      </div>
      {snapshotSummary && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-indigo-700 font-semibold">Snapshot context used for coaching insights</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-indigo-900 font-mono leading-relaxed">
{snapshotSummary}
          </pre>
        </div>
      )}

      {isRefreshing && (
        <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-700">
          <RefreshCcw className="h-4 w-4 animate-spin" />
          <span>Refreshing latest coaching insights…</span>
        </div>
      )}

      {hasSmartInsightsError && !showSpinner && (
        <div className={`rounded-lg px-3 py-2 text-sm ${
          hasAdvice ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {hasAdvice
            ? `Showing cached coaching insights. Latest refresh failed: ${smartInsightsError}`
            : `Unable to load coaching insights: ${smartInsightsError}`}
        </div>
      )}

      {showSpinner ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Analyzing clan data...</span>
        </div>
      ) : advice.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No coaching advice generated yet.</p>
          <p className="text-sm">Click &quot;Generate New Advice&quot; to get personalized coaching tips for your clan!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {advice
            .map((item, index) => ({ item, index, tipId: generateTipId(item, index) }))
            .filter(({ tipId }) => showActioned ? actionedTips.has(tipId) : !actionedTips.has(tipId))
            .sort((a, b) => {
              // Sort by priority: high > medium > low
              const priorityOrder = { high: 3, medium: 2, low: 1 };
              return priorityOrder[b.item.priority] - priorityOrder[a.item.priority];
            })
            .map(({ item, index, tipId }) => (
            <div
              key={tipId}
              className={`border rounded-lg p-6 ${getPriorityColor(item.priority)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon(item.priority)}
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.priority === "high" ? "bg-red-100 text-red-800" :
                        item.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
                        "bg-green-100 text-green-800"
                      }`}>
                        {item.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <p className="text-sm text-gray-600">{item.category}</p>
                      {item.date && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          📅 {item.date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {!showActioned ? (
                  <button
                    onClick={() => markAsActioned(tipId)}
                    className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                    title="Mark as actioned"
                  >
                    <input type="checkbox" className="w-4 h-4" />
                    <span>✓ Actioned</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                    <input type="checkbox" className="w-4 h-4" checked readOnly />
                    <span>✓ Actioned</span>
                  </div>
                )}
              </div>

              <p className="text-gray-700 mb-4">{item.description}</p>

              {item.chatMessage && (
                <div className="bg-white rounded-lg p-4 border">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">Ready-to-paste chat message:</h4>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => copyToClipboard(item.chatMessage!, `message-${tipId}`)}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        <span>{copiedMessage === `message-${tipId}` ? "Copied!" : "Copy"}</span>
                      </button>
                      <button
                        onClick={() => shareToDiscord(item, tipId)}
                        disabled={isSharingToDiscord === tipId}
                        className="flex items-center space-x-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Share to Discord with snapshot context"
                      >
                        <Send className="w-4 h-4" />
                        <span>{isSharingToDiscord === tipId ? "Sharing..." : "Share"}</span>
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-3 text-sm text-gray-800 font-mono">
                    {item.chatMessage}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
