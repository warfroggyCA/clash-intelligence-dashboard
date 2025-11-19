"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { MessageSquare, Send, Settings, AlertTriangle, Users, Trophy, TrendingUp, Swords, Copy, Check } from "lucide-react";
import { formatWarResultForDiscord, type WarResultPayload } from "@/lib/export-utils";
import { normalizeTag } from "@/lib/tags";
import { api } from "@/lib/api/client";

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
  role?: string;
  tenure_days?: number;
  tenure?: number;
  lastSeen?: string | number;
}

interface Roster {
  source: "live" | "fallback" | "snapshot";
  date?: string;
  clanName?: string;
  members: Member[];
  meta?: any;
  snapshotDetails?: {
    currentWar?: any;
    warLog?: any[];
  };
}

interface DiscordPublisherProps {
  clanData: Roster | null;
  clanTag: string;
  warPlanSummary?: WarPlanSummary | null;
}

interface WarPlanSummary {
  opponentName?: string | null;
  opponentTag?: string | null;
  confidence?: number | null;
  outlook?: string | null;
  recommendations?: string[] | null;
  slotHighlights?: Array<{
    slot: number;
    ourName?: string | null;
    opponentName?: string | null;
    summary: string;
  }>;
}

interface WarResultNotes {
  mvpName: string;
  mvpTag: string;
  mvpStars: string;
  mvpSummary: string;
  topPerformers: Array<{ name: string; tag: string; stars: string; summary: string }>;
  bravestName: string;
  bravestTag: string;
  bravestStars: string;
  bravestSummary: string;
  learningsText: string;
}

// Rush percentage calculation (same as in other components)
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

interface DerivedAttack {
  memberName: string;
  memberTag?: string | null;
  stars: number;
  destruction: number;
  order?: number;
  defenderName?: string | null;
  defenderTag?: string | null;
  defenderTownHall?: number;
  attackerTownHall?: number;
  memberPosition?: number;
}

interface AutoWarPerformer {
  name: string;
  tag?: string | null;
  stars?: number;
  totalStars?: number;
  summary?: string;
  braveryAttack?: DerivedAttack | null;
}

interface AutoWarNotes {
  mvp?: AutoWarPerformer;
  topPerformers: AutoWarPerformer[];
  bravest?: AutoWarPerformer;
  learnings?: string[];
}

interface AiWarPerformerPayload {
  name: string;
  tag?: string;
  stars?: number;
  summary?: string;
  townHallDelta?: number;
}

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const describeTownHallMatchup = (attack: DerivedAttack): string | null => {
  if (
    attack.attackerTownHall == null ||
    Number.isNaN(attack.attackerTownHall) ||
    attack.defenderTownHall == null ||
    Number.isNaN(attack.defenderTownHall)
  ) {
    return null;
  }
  const delta = attack.defenderTownHall - attack.attackerTownHall;
  const direction = delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : 'even';
  return `TH${attack.attackerTownHall}→TH${attack.defenderTownHall} (${direction})`;
};

const formatAttackSummary = (attack: DerivedAttack): string => {
  const parts: string[] = [];
  if (!Number.isNaN(attack.stars)) {
    parts.push(`${attack.stars}★`);
  }
  if (Number.isFinite(attack.destruction)) {
    parts.push(`${attack.destruction.toFixed(1)}%`);
  }
  const matchup = describeTownHallMatchup(attack);
  if (matchup) {
    parts.push(matchup);
  }
  if (attack.defenderName) {
    parts.push(`vs ${attack.defenderName}`);
  } else if (attack.defenderTag) {
    parts.push(`vs ${attack.defenderTag}`);
  } else if (attack.order != null) {
    parts.push(`vs slot ${attack.order}`);
  }
  return parts.join(' • ');
};

const normalizePlayerTag = (value?: string | null): string | null => {
  if (!value || typeof value !== 'string') return null;
  return normalizeTag(value);
};

const buildAttackRecord = (
  member: any,
  attack: any,
  index: number,
  opponentLookup: Map<string, { name?: string | null; tag?: string | null; townHallLevel?: number | null }>
): DerivedAttack | null => {
  const memberName = member?.name || member?.tag || 'Unknown player';
  const memberTag = member?.tag ?? null;
  const stars = parseNumber(attack?.stars ?? attack?.attackerStars ?? attack?.starCount) ?? 0;
  const destruction =
    parseNumber(
      attack?.destructionPercentage ??
        attack?.destruction ??
        attack?.destruction_percent ??
        attack?.damagePercent
    ) ?? 0;
  const order = parseNumber(attack?.order ?? attack?.attackOrder ?? index + 1);
  const defenderName =
    attack?.defenderName ??
    attack?.defender?.name ??
    attack?.defender?.playerName ??
    attack?.defenderPlayerName ??
    null;
  const defenderTagNormalized = normalizePlayerTag(
    attack?.defenderTag ?? attack?.defender?.tag ?? attack?.defenderPlayerTag ?? null
  );
  const defenderLookup = defenderTagNormalized ? opponentLookup.get(defenderTagNormalized) : null;
  const defenderTag = defenderTagNormalized ?? defenderLookup?.tag ?? null;
  const defenderTownHall =
    parseNumber(
      attack?.defenderTownHallLevel ??
        attack?.defenderTownhallLevel ??
        attack?.defenderTownhall ??
        attack?.defender?.townHallLevel ??
        defenderLookup?.townHallLevel
    ) ?? undefined;
  const memberPosition =
    parseNumber(member?.mapPosition ?? member?.clanRank ?? member?.position ?? null) ?? undefined;
  const attackerTownHall =
    parseNumber(
      member?.townhallLevel ??
        member?.townHallLevel ??
        member?.town_hall_level ??
        member?.mapTownHallLevel
    ) ?? undefined;

  return {
    memberName,
    memberTag,
    stars,
    destruction,
    order: order ?? undefined,
    defenderName: defenderLookup?.name ?? defenderName,
    defenderTag,
    defenderTownHall,
    attackerTownHall,
    memberPosition,
  };
};

const computeTownHallDelta = (attack: DerivedAttack | null | undefined): number => {
  if (!attack || attack.attackerTownHall == null || attack.defenderTownHall == null) return 0;
  return attack.defenderTownHall - attack.attackerTownHall;
};

const chooseBravestAttack = (
  attacks: DerivedAttack[],
  teamSize: number,
  fallback?: DerivedAttack | null
): DerivedAttack | null => {
  if (!attacks.length) return fallback ?? null;
  const entries = attacks.map((attack) => ({
    attack,
    delta: computeTownHallDelta(attack),
  }));
  const positive = entries.filter((entry) => entry.delta > 0);
  const list = positive.length ? positive : entries;
  return list
    .slice()
    .sort((a, b) => {
      if (b.delta !== a.delta) return b.delta - a.delta;
      const starDiff = b.attack.stars - a.attack.stars;
      if (starDiff !== 0) return starDiff;
      const destructionDiff = b.attack.destruction - a.attack.destruction;
      if (destructionDiff !== 0) return destructionDiff;
      const slotBonusA =
        teamSize && a.attack.memberPosition
          ? Math.max(0, a.attack.memberPosition - Math.max(0, teamSize - 5))
          : 0;
      const slotBonusB =
        teamSize && b.attack.memberPosition
          ? Math.max(0, b.attack.memberPosition - Math.max(0, teamSize - 5))
          : 0;
      return slotBonusB - slotBonusA;
    })[0]?.attack;
};

const buildOpponentLookup = (
  warEntry: any
): Map<string, { name?: string | null; tag?: string | null; townHallLevel?: number | null }> => {
  const lookup = new Map<string, { name?: string | null; tag?: string | null; townHallLevel?: number | null }>();
  const members = Array.isArray(warEntry?.opponent?.members) ? warEntry.opponent.members : [];
  members.forEach((member: any) => {
    const tag = normalizePlayerTag(member?.tag);
    if (!tag) return;
    lookup.set(tag, {
      name: member?.name ?? member?.tag ?? null,
      tag: member?.tag ?? tag,
      townHallLevel:
        parseNumber(
          member?.townhallLevel ??
            member?.townHallLevel ??
            member?.town_hall_level ??
            member?.mapTownHallLevel
        ) ?? null,
    });
  });
  return lookup;
};

interface RosterContextSummary {
  memberCount?: number;
  averageTownHall?: number;
  recentWinRate?: number;
  newMemberCount?: number;
}

const buildRosterContext = (clanData: Roster | null): RosterContextSummary | null => {
  if (!clanData?.members?.length) return null;
  const members = clanData.members;
  const memberCount = members.length;
  const averageTownHallRaw =
    memberCount > 0
      ? members.reduce((sum, member) => sum + (member.townHallLevel ?? member.th ?? 0), 0) /
        memberCount
      : null;
  const newMemberCount = members.filter((member) => {
    const tenure = member.tenure_days ?? (member as any)?.tenure ?? null;
    return tenure != null && Number.isFinite(tenure) && tenure <= 14;
  }).length;
  const warLog = Array.isArray(clanData.snapshotDetails?.warLog)
    ? clanData.snapshotDetails?.warLog ?? []
    : [];
  const wins = warLog.filter(
    (entry: any) => typeof entry?.result === 'string' && entry.result.toLowerCase().includes('win')
  ).length;
  const recentWinRate = warLog.length ? (wins / warLog.length) * 100 : null;

  return {
    memberCount,
    averageTownHall:
      averageTownHallRaw != null && Number.isFinite(averageTownHallRaw)
        ? Number(averageTownHallRaw.toFixed(2))
        : undefined,
    newMemberCount: newMemberCount || undefined,
    recentWinRate:
      recentWinRate != null && Number.isFinite(recentWinRate)
        ? Number(recentWinRate.toFixed(1))
        : undefined,
  };
};

const cleanAiLines = (lines: string[]): string[] =>
  lines
    .map((line) =>
      line
        .replace(/^[\s\-*•]+/, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/^Learning\s*\d+:?\s*/i, '')
        .trim()
    )
    .filter(Boolean);

const deriveWarLearnings = (params: {
  warResultBase: WarResultPayload | null;
  topPerformers: AutoWarPerformer[];
  bravest?: AutoWarPerformer;
}): string[] => {
  const { warResultBase, topPerformers, bravest } = params;
  const learnings: string[] = [];
  if (!warResultBase) return learnings;
  const starDiff = warResultBase.ourStars - warResultBase.opponentStars;
  const percentDiff =
    warResultBase.ourPercent != null && warResultBase.opponentPercent != null
      ? warResultBase.ourPercent - warResultBase.opponentPercent
      : null;
  const opponentLabel = warResultBase.opponentName || warResultBase.opponentTag;

  if (starDiff >= 2) {
    learnings.push(
      `Controlled win vs ${opponentLabel} — ${warResultBase.ourStars}-${warResultBase.opponentStars}${
        percentDiff != null ? ` (${percentDiff.toFixed(1)}% destruction edge)` : ''
      } with steady triples in the high slots.`
    );
  } else if (starDiff <= -1) {
    learnings.push(
      `Tough loss vs ${opponentLabel} — down ${Math.abs(starDiff)}⭐${
        percentDiff != null ? ` and ${Math.abs(percentDiff).toFixed(1)}% destruction` : ''
      }. Prioritize cleanup rehearsals and hero uptime before queuing again.`
    );
  } else {
    learnings.push(
      `Photo finish — ${warResultBase.ourStars}-${warResultBase.opponentStars}${
        percentDiff != null ? ` (${percentDiff.toFixed(1)}% destruction swing)` : ''
      }. Every cleanup mattered down the stretch.`
    );
  }

  if (topPerformers.length) {
    const highlight = topPerformers
      .slice(0, 2)
      .map((perf) => `${perf.name}${perf.summary ? ` (${perf.summary})` : ''}`)
      .join(' & ');
    learnings.push(`Top performers: ${highlight}. Use their plans as templates for the next lineup.`);
  }

  if (bravest?.braveryAttack) {
    const delta = computeTownHallDelta(bravest.braveryAttack);
    if (delta > 0) {
      learnings.push(
        `${bravest.name} climbed ${delta} TH tier${delta === 1 ? '' : 's'} to crack ${
          bravest.braveryAttack.defenderName || 'the top base'
        } — keep rewarding fearless targets like that.`
      );
    } else {
      learnings.push(
        `${bravest.name} delivered the cleanest execution (${bravest.braveryAttack.summary}); replicate that precision on future cleanups.`
      );
    }
  } else {
    learnings.push('No upward TH hits landed this war — schedule dip drills before the next matchmaking cycle.');
  }

  return learnings;
};

const deriveWarResultNotes = (warEntry: any, warResultBase: WarResultPayload | null): AutoWarNotes | null => {
  if (!warEntry) return null;
  
  const clanMembers = Array.isArray(warEntry?.clan?.members) ? warEntry.clan.members : [];
  
  // If we have member attack data, use the full auto-fill logic
  if (clanMembers.length > 0) {

    const teamSize = parseNumber(warEntry?.teamSize ?? warEntry?.clan?.teamSize ?? null) ?? 0;
    const opponentLookup = buildOpponentLookup(warEntry);

    const allAttacks: DerivedAttack[] = [];
    const performerStats = clanMembers
      .map((member: any) => {
        const attacks = Array.isArray(member.attacks) ? member.attacks : [];
        const attackRecords = attacks
          .map((attack: any, idx: number) => buildAttackRecord(member, attack, idx, opponentLookup))
          .filter(Boolean) as DerivedAttack[];
        allAttacks.push(...attackRecords);
        const bestAttack = attackRecords.reduce<DerivedAttack | null>((prev, current) => {
          if (!prev) return current;
          if (current.stars > prev.stars) return current;
          if (current.stars === prev.stars && current.destruction > prev.destruction) return current;
          return prev;
        }, null);
        const braveryAttack = chooseBravestAttack(attackRecords, teamSize, bestAttack);
        const totalStars = attackRecords.reduce((sum, attack) => sum + (attack.stars || 0), 0);
        const destruction =
          parseNumber(member?.destructionPercentage ?? member?.destruction ?? null) ?? 0;
        return {
          name: member?.name || member?.tag || 'Unknown player',
          tag: member?.tag ?? null,
          totalStars,
          destruction,
          bestAttack,
          braveryAttack,
        };
      })
      .filter(
        (stat) =>
          stat.name &&
          (stat.totalStars > 0 || stat.destruction > 0 || stat.bestAttack || stat.braveryAttack)
      );

    if (!performerStats.length) return null;

    const sortedPerformers = performerStats.sort((a, b) => {
      const starDiff = (b.totalStars ?? 0) - (a.totalStars ?? 0);
      if (starDiff !== 0) return starDiff;
      const bestAttackStarDiff = (b.bestAttack?.stars ?? 0) - (a.bestAttack?.stars ?? 0);
      if (bestAttackStarDiff !== 0) return bestAttackStarDiff;
      const destructionDiff = b.destruction - a.destruction;
      if (destructionDiff !== 0) return destructionDiff;
      const braveryDiff = computeTownHallDelta(b.braveryAttack) - computeTownHallDelta(a.braveryAttack);
      if (braveryDiff !== 0) return braveryDiff;
      return (a.name || '').localeCompare(b.name || '');
    });

    const formatSummary = (stat: typeof performerStats[number]): string => {
      const source = stat.bestAttack || stat.braveryAttack;
      if (source) {
        const summary = formatAttackSummary(source);
        if (summary) return summary;
      }
      const parts: string[] = [];
      if (stat.totalStars > 0) {
        parts.push(`${stat.totalStars}★`);
      }
      if (Number.isFinite(stat.destruction)) {
        parts.push(`${stat.destruction.toFixed(1)}%`);
      }
      return parts.join(' • ') || 'Key attack';
    };

    const topPerformers = sortedPerformers.slice(0, 3).map((stat) => ({
      name: stat.name,
      tag: stat.tag ?? undefined,
      stars: Number.isFinite(stat.totalStars) ? stat.totalStars : undefined,
      totalStars: stat.totalStars,
      summary: formatSummary(stat),
      braveryAttack: stat.braveryAttack ?? stat.bestAttack ?? null,
    }));

    const bravestAttack = chooseBravestAttack(allAttacks, teamSize, null);
    const learnings = deriveWarLearnings({
      warResultBase,
      topPerformers,
      bravest:
        bravestAttack && topPerformers.length
          ? {
              name: bravestAttack.memberName,
              tag: bravestAttack.memberTag ?? undefined,
              stars: Number.isFinite(bravestAttack.stars) ? bravestAttack.stars : undefined,
              totalStars: bravestAttack.stars,
              summary: formatAttackSummary(bravestAttack),
              braveryAttack: bravestAttack,
            }
          : undefined,
    });

    return {
      mvp: topPerformers[0],
      topPerformers,
      bravest: bravestAttack
        ? {
            name: bravestAttack.memberName,
            tag: bravestAttack.memberTag ?? undefined,
            stars: Number.isFinite(bravestAttack.stars) ? bravestAttack.stars : undefined,
            totalStars: bravestAttack.stars,
            summary: formatAttackSummary(bravestAttack),
            braveryAttack: bravestAttack,
          }
        : undefined,
      learnings,
    };
  }
  
  // Fallback: If we only have war log summary (no member attack data), return basic learnings
  const mapResultLabel = (result?: string | null): string => {
    if (!result) return 'War result';
    const normalized = result.toLowerCase();
    if (normalized.includes('win')) return 'Victory';
    if (normalized.includes('loss') || normalized.includes('lose')) return 'Defeat';
    if (normalized.includes('draw') || normalized.includes('tie')) return 'Draw';
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  const opponentName =
    warResultBase?.opponentName || warEntry?.opponent?.name || warEntry?.opponentName || 'Opponent';
  const scoreline = `${warResultBase?.ourStars ?? parseNumber(warEntry?.clan?.stars) ?? 0}-${
    warResultBase?.opponentStars ?? parseNumber(warEntry?.opponent?.stars) ?? 0
  }`;
  const percentLine =
    warResultBase?.ourPercent != null && warResultBase?.opponentPercent != null
      ? ` (${warResultBase.ourPercent.toFixed(1)}% vs ${warResultBase.opponentPercent.toFixed(1)}%)`
      : '';
  
  const basicLearnings: string[] = [];
  basicLearnings.push(
    `${mapResultLabel(warResultBase?.result ?? warEntry?.result)} vs ${opponentName} (${scoreline}${percentLine})`
  );

  if (warResultBase?.result === 'loss') {
    basicLearnings.push('Hero upgrades and attack planning need reinforcement before the next war.');
  } else if (warResultBase?.result === 'win') {
    basicLearnings.push('Duplicate the successful attack plans and keep heroes ready for the next push.');
  } else {
    basicLearnings.push('Keep sharpening cleanup plans to tip the balance next war.');
  }

  // Return minimal auto-fill - just learnings, no MVP/bravest since we don't have attack data
  return {
    mvp: undefined,
    topPerformers: [],
    bravest: undefined,
    learnings: basicLearnings,
  };
};

export default function DiscordPublisher({ clanData, clanTag, warPlanSummary }: DiscordPublisherProps) {
  const [selectedExhibit, setSelectedExhibit] = useState<string>("rushed");
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [previewMessage, setPreviewMessage] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [warResultNotes, setWarResultNotes] = useState<WarResultNotes>({
    mvpName: "",
    mvpTag: "",
    mvpStars: "",
    mvpSummary: "",
    topPerformers: Array.from({ length: 3 }, () => ({ name: "", tag: "", stars: "", summary: "" })),
    bravestName: "",
    bravestTag: "",
    bravestStars: "",
    bravestSummary: "",
    learningsText: "",
  });
  const [hasUserOverriddenLearnings, setHasUserOverriddenLearnings] = useState(false);
  const hasUserOverriddenLearningsRef = useRef(false);
  useEffect(() => {
    hasUserOverriddenLearningsRef.current = hasUserOverriddenLearnings;
  }, [hasUserOverriddenLearnings]);
  const lastAutoLearningsRef = useRef<string>("");
  const [aiLearningsState, setAiLearningsState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    signature: string | null;
    error: string | null;
  }>({ status: 'idle', signature: null, error: null });
  const [aiRequestNonce, setAiRequestNonce] = useState(0);
  const pendingAiTokenRef = useRef<string | null>(null);
  const lastCompletedAiTokenRef = useRef<string | null>(null);
  const updateWarResultField = (field: keyof Omit<WarResultNotes, 'topPerformers'>, value: string) => {
    setWarResultNotes((prev) => ({ ...prev, [field]: value }));
  };
  const updateTopPerformer = (index: number, field: keyof WarResultNotes['topPerformers'][number], value: string) => {
    setWarResultNotes((prev) => {
      const next = prev.topPerformers.map((perf, idx) =>
        idx === index ? { ...perf, [field]: value } : perf
      );
      return { ...prev, topPerformers: next };
    });
  };
  const handleLearningsChange = (value: string) => {
    setHasUserOverriddenLearnings(true);
    setWarResultNotes((prev) => ({ ...prev, learningsText: value }));
  };
  const rosterContext = useMemo(() => buildRosterContext(clanData), [clanData]);
  const requestAiLearnings = () => {
    setAiLearningsState({ status: 'idle', signature: null, error: null });
    setAiRequestNonce((token) => token + 1);
  };
  const restoreAiLearnings = () => {
    if (lastAutoLearningsRef.current) {
      setHasUserOverriddenLearnings(false);
      hasUserOverriddenLearningsRef.current = false;
      setWarResultNotes((prev) => ({ ...prev, learningsText: lastAutoLearningsRef.current }));
    } else {
      setHasUserOverriddenLearnings(false);
      hasUserOverriddenLearningsRef.current = false;
      requestAiLearnings();
    }
  };

  // Load webhook URL from localStorage
  useState(() => {
    const saved = localStorage.getItem(`discord_webhook_${clanTag}`);
    if (saved) {
      setWebhookUrl(saved);
    }
  });

  const saveWebhookUrl = (url: string) => {
    setWebhookUrl(url);
    localStorage.setItem(`discord_webhook_${clanTag}`, url);
  };

  const generateRushedExhibit = (): string => {
    if (!clanData || !clanData.members) return "";

    const members = clanData.members;
    const thCaps = calculateThCaps(members);
    
    // Calculate rush percentages for all members
    const membersWithRush = members.map(member => {
      const rushPercentage = rushPercent(member, thCaps);
      return { ...member, rushPercentage };
    });

    // Filter for red (70%+) and amber (50-69%) level rushes
    const redRushedMembers = membersWithRush
      .filter(member => member.rushPercentage >= 70)
      .sort((a, b) => b.rushPercentage - a.rushPercentage);
    
    const amberRushedMembers = membersWithRush
      .filter(member => member.rushPercentage >= 40 && member.rushPercentage < 70)
      .sort((a, b) => b.rushPercentage - a.rushPercentage);

    const totalRushedMembers = redRushedMembers.length + amberRushedMembers.length;

    if (totalRushedMembers === 0) {
      return `🎯 **Rush Analysis for ${clanData.clanName || 'Your Clan'}**\n\n✅ **Great news!** No rushed players detected in the clan. Everyone is developing their bases at an appropriate pace for their Town Hall level.\n\n📊 **Rush Percentage Explained:** This bot tracks how far behind each player's heroes are compared to their Town Hall level. A higher percentage means they're more rushed and need to focus on heroes before advancing further.`;
    }

    let message = `🚨 **Rushed Players Analysis - ${clanData.clanName || 'Your Clan'}**\n\n`;
    message += `📊 **Rush Percentage Explained:** This bot tracks how far behind each player's heroes are compared to their Town Hall level. A higher percentage means they're more rushed and need to focus on heroes before advancing further.\n\n`;
    
    if (redRushedMembers.length > 0) {
      message += `🔴 **${redRushedMembers.length} severely rushed players (70%+)** need immediate attention:\n\n`;

      redRushedMembers.slice(0, 10).forEach((member, index) => {
        const th = getTH(member);
        
        message += `🔴 **${member.name}** (TH${th})\n`;
        message += `   • Rush Level: **${member.rushPercentage}%** (SEVERELY RUSHED!)\n`;
        
        // Add hero details
        const heroDetails = [];
        if (member.bk) heroDetails.push(`BK:${member.bk}`);
        if (member.aq) heroDetails.push(`AQ:${member.aq}`);
        if (member.gw) heroDetails.push(`GW:${member.gw}`);
        if (member.rc) heroDetails.push(`RC:${member.rc}`);
        if (member.mp) heroDetails.push(`MP:${member.mp}`);
        
        if (heroDetails.length > 0) {
          message += `   • Heroes: ${heroDetails.join(" | ")}\n`;
        }
        
        message += `   • Role: ${member.role || 'Member'}\n\n`;
      });

      if (redRushedMembers.length > 10) {
        message += `... and ${redRushedMembers.length - 10} more severely rushed players need attention.\n\n`;
      }
    }
    
    if (amberRushedMembers.length > 0) {
      message += `🟡 **${amberRushedMembers.length} moderately rushed players (40-69%)** need attention:\n\n`;

      amberRushedMembers.slice(0, 10).forEach((member, index) => {
        const th = getTH(member);
        
        message += `🟡 **${member.name}** (TH${th})\n`;
        message += `   • Rush Level: **${member.rushPercentage}%** (moderately rushed)\n`;
        
        // Add hero details
        const heroDetails = [];
        if (member.bk) heroDetails.push(`BK:${member.bk}`);
        if (member.aq) heroDetails.push(`AQ:${member.aq}`);
        if (member.gw) heroDetails.push(`GW:${member.gw}`);
        if (member.rc) heroDetails.push(`RC:${member.rc}`);
        if (member.mp) heroDetails.push(`MP:${member.mp}`);
        
        if (heroDetails.length > 0) {
          message += `   • Heroes: ${heroDetails.join(" | ")}\n`;
        }
        
        message += `   • Role: ${member.role || 'Member'}\n\n`;
      });

      if (amberRushedMembers.length > 10) {
        message += `... and ${amberRushedMembers.length - 10} more moderately rushed players need attention.\n\n`;
      }
    }

    if (redRushedMembers.length > 0) {
      message += `💡 **URGENT RECOMMENDATION:** Severely rushed players (70%+) need to STOP upgrading Town Hall and focus ONLY on heroes and defenses. Their rush level is severely impacting clan war performance!\n\n`;
    }
    if (amberRushedMembers.length > 0) {
      message += `💡 **MODERATE RECOMMENDATION:** Moderately rushed players (40-69%) should prioritize hero upgrades before advancing Town Hall. This will improve their war performance and clan contribution.`;
    }

    return message;
  };

  const generateDonationExhibit = (): string => {
    if (!clanData || !clanData.members) return "";

    const members = clanData.members;
    const totalDonations = members.reduce((sum, m) => sum + (m.donations || 0), 0);
    const avgDonations = totalDonations / members.length;

    // Find top and bottom performers
    const sortedByDonations = members.sort((a, b) => (b.donations || 0) - (a.donations || 0));
    const topDonators = sortedByDonations.slice(0, 5);
    const lowDonators = sortedByDonations.slice(-5).reverse();

    let message = `💝 **Donation Analysis for ${clanData.clanName || 'Your Clan'}**\n\n`;
    message += `📈 **Total Donations:** ${totalDonations.toLocaleString()}\n`;
    message += `📊 **Average per Member:** ${Math.round(avgDonations)}\n\n`;

    message += `🏆 **Top Donators:**\n`;
    topDonators.forEach((member, index) => {
      message += `${index + 1}. **${member.name}** - ${member.donations?.toLocaleString() || 0} donations\n`;
    });

    message += `\n⚠️ **Members Needing Improvement:**\n`;
    lowDonators.forEach((member, index) => {
      const donations = member.donations || 0;
      const deficit = avgDonations - donations;
      message += `${index + 1}. **${member.name}** - ${donations} donations (${Math.round(deficit)} below average)\n`;
    });

    return message;
  };

  const parseNumber = (value: unknown): number | null => {
    if (value == null) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const computeTenureDays = (member: Member): number | null => {
    const direct = parseNumber(member.tenure_days ?? member.tenure);
    if (direct != null) return direct;
    const joinedAt = (member as any)?.joinedAt;
    if (joinedAt) {
      const date = new Date(joinedAt);
      if (!Number.isNaN(date.getTime())) {
        const diff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(0, Math.round(diff));
      }
    }
    return null;
  };

  const computeDaysSinceSeen = (member: Member): number | null => {
    const value = parseNumber(member.lastSeen);
    if (value != null) return value;
    if (typeof member.lastSeen === 'string' && member.lastSeen.trim().length > 0) {
      const date = new Date(member.lastSeen);
      if (!Number.isNaN(date.getTime())) {
        const diff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(0, Math.round(diff));
      }
    }
    const lastSeenAt = (member as any)?.lastSeenAt;
    if (lastSeenAt) {
      const date = new Date(lastSeenAt);
      if (!Number.isNaN(date.getTime())) {
        const diff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(0, Math.round(diff));
      }
    }
    return null;
  };

  const generateActivityExhibit = (): string => {
    if (!clanData || !clanData.members) return "";

    const members = clanData.members;
    const activeMembers = members.filter((m) => {
      const days = computeDaysSinceSeen(m);
      return days !== null && days <= 1;
    });
    const inactiveMembers = members.filter((m) => {
      const days = computeDaysSinceSeen(m);
      return days !== null && days > 3;
    });
    const newMembers = members.filter((m) => {
      const tenure = computeTenureDays(m);
      return tenure !== null && tenure < 7;
    });

    let message = `🏁 **Activity Report for ${clanData.clanName || 'Your Clan'}**\n\n`;
    
    message += `🟢 **Active Members:** ${activeMembers.length}/${members.length}\n`;
    message += `🟡 **Inactive Members:** ${inactiveMembers.length}/${members.length}\n`;
    message += `🆕 **New Members:** ${newMembers.length}/${members.length}\n\n`;

    if (inactiveMembers.length > 0) {
      message += `⚠️ **Inactive Members (>3 days):**\n`;
      inactiveMembers.slice(0, 10).forEach((member) => {
        const days = computeDaysSinceSeen(member);
        const daysText = days != null ? `${days} day${days === 1 ? '' : 's'} ago` : 'unknown';
        message += `• **${member.name}** - Last seen ${daysText}\n`;
      });
    } else {
      message += `✅ **No members have been inactive for more than 3 days.**\n`;
    }

    if (newMembers.length > 0) {
      message += `\n🆕 **New Members (<7 days):**\n`;
      newMembers.forEach((member) => {
        const tenure = computeTenureDays(member);
        const tenureText = tenure != null ? `${tenure} day${tenure === 1 ? '' : 's'} ago` : 'recently';
        message += `• **${member.name}** - Joined ${tenureText}\n`;
      });
    }

    return message;
  };

  const formatWarResult = (result: string | undefined) => {
    if (!result) return 'Unknown';
    const normalized = result.toLowerCase();
    if (normalized === 'win') return '🏆 Win';
    if (normalized === 'loss') return '❌ Loss';
    if (normalized === 'tie' || normalized === 'draw') return '🤝 Tie';
    return result;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const generateWarReport = (): string => {
    if (warPlanSummary) {
      const lines: string[] = [];
      const opponentLabel = warPlanSummary.opponentName || warPlanSummary.opponentTag || 'Opponent';
      lines.push(`⚔️ **War Plan vs ${opponentLabel}**`);
      if (warPlanSummary.confidence != null || warPlanSummary.outlook) {
        const confidenceText =
          warPlanSummary.confidence != null ? `${warPlanSummary.confidence.toFixed(1)}%` : 'Unknown';
        const outlookText = warPlanSummary.outlook ?? 'Unknown outlook';
        lines.push(`Confidence: ${confidenceText} • Outlook: ${outlookText}`);
      }
      if (warPlanSummary.recommendations?.length) {
        lines.push('\n**Key Recommendations:**');
        warPlanSummary.recommendations.slice(0, 4).forEach((rec) => {
          lines.push(`• ${rec}`);
        });
      }
      if (warPlanSummary.slotHighlights?.length) {
        lines.push('\n**Priority Matchups:**');
        warPlanSummary.slotHighlights.slice(0, 6).forEach((slot) => {
          const our = slot.ourName ?? `Slot ${slot.slot}`;
          const opp = slot.opponentName ? ` vs ${slot.opponentName}` : '';
          lines.push(`• ${our}${opp} — ${slot.summary}`);
        });
      }
      lines.push('\n_Ref: Stored war plan analysis_');
      return lines.join('\n');
    }

    if (!clanData) return '';
    const currentWar = clanData.snapshotDetails?.currentWar;
    const warLog = clanData.snapshotDetails?.warLog ?? [];

    let message = `⚔️ **War Report for ${clanData.clanName || 'Your Clan'}**\n\n`;

    if (currentWar) {
      const opponentName = currentWar.opponent?.name || 'Unknown Opponent';
      const opponentTag = currentWar.opponent?.tag ? ` (${currentWar.opponent.tag})` : '';
      message += `**Current War:** ${opponentName}${opponentTag}\n`;
      message += `State: ${currentWar.state || 'Unknown'}\n`;
      if (currentWar.teamSize) {
        message += `Team Size: ${currentWar.teamSize}x${currentWar.teamSize}\n`;
      }
      if (currentWar.attacksPerMember) {
        message += `Attacks per Member: ${currentWar.attacksPerMember}\n`;
      }
      if (currentWar.startTime) {
        message += `War Start: ${formatDate(currentWar.startTime)}\n`;
      }
      if (currentWar.endTime) {
        message += `War End: ${formatDate(currentWar.endTime)}\n`;
      }
      message += '\n';
    } else {
      message += 'No active war information available.\n\n';
    }

    if (warLog.length) {
      message += '**Recent Wars:**\n';
      warLog.slice(0, 3).forEach((entry) => {
        const opponent = entry.opponent?.name || 'Unknown';
        const outcome = formatWarResult(entry.result);
        const when = formatDate(entry.endTime);
        message += `• ${outcome} vs ${opponent} (${entry.teamSize}v${entry.teamSize}) on ${when}\n`;
      });
    } else {
      message += 'No recent war log data available.';
    }

    return message;
  };

  const warEntry = clanData?.snapshotDetails?.warLog?.[0];
  const currentWar = clanData?.snapshotDetails?.currentWar;
  const [enrichedWarEntry, setEnrichedWarEntry] = useState<any>(warEntry);
  const [isEnriching, setIsEnriching] = useState<boolean>(false);

  // Check if currentWar matches the latest war log entry and use its member data
  useEffect(() => {
    console.log('[DiscordPublisher] War enrichment check', {
      hasWarEntry: !!warEntry,
      warEntryHasMembers: !!(warEntry?.clan?.members?.length),
      hasCurrentWar: !!currentWar,
      currentWarHasMembers: !!(currentWar?.clan?.members?.length),
      warEntryEndTime: warEntry?.endTime,
      currentWarEndTime: currentWar?.endTime,
    });

    if (!warEntry) {
      console.log('[DiscordPublisher] No war entry, clearing enriched entry');
      setEnrichedWarEntry(null);
      setIsEnriching(false);
      return;
    }

    // If war entry already has member data, use it
    if (warEntry?.clan?.members?.length) {
      console.log('[DiscordPublisher] War entry already has member data, using as-is', {
        memberCount: warEntry.clan.members.length,
      });
      setEnrichedWarEntry(warEntry);
      setIsEnriching(false);
      return;
    }

    setIsEnriching(true);

    // Check if currentWar matches this war log entry (by opponent tag and endTime)
    const warEntryOpponentTag = normalizeTag(warEntry.opponent?.tag || '');
    const currentWarOpponentTag = normalizeTag(currentWar?.opponent?.tag || '');
    const warEntryEndTime = warEntry.endTime;
    const currentWarEndTime = currentWar?.endTime;

    console.log('[DiscordPublisher] Checking currentWar match', {
      warEntryOpponentTag,
      currentWarOpponentTag,
      warEntryEndTime,
      currentWarEndTime,
      tagsMatch: warEntryOpponentTag === currentWarOpponentTag,
      timesMatch: warEntryEndTime === currentWarEndTime,
    });

    if (
      currentWar?.clan?.members?.length &&
      warEntryOpponentTag === currentWarOpponentTag &&
      warEntryEndTime === currentWarEndTime
    ) {
      // Use currentWar's member data since it matches
      console.log('[DiscordPublisher] currentWar matches war log entry, using currentWar member data', {
        memberCount: currentWar.clan.members.length,
      });
      setEnrichedWarEntry({
        ...warEntry,
        clan: {
          ...warEntry.clan,
          members: currentWar.clan.members,
        },
      });
      setIsEnriching(false);
      return;
    }

    // Try to fetch detailed war data from our database
    const fetchWarDetails = async () => {
      try {
        const warId = warEntry.endTime || warEntry.warId;
        if (!warId) {
          console.log('[DiscordPublisher] No warId available, using summary only');
          setEnrichedWarEntry(warEntry);
          return;
        }

        const normalizedClanTag = normalizeTag((clanData as any)?.clanTag || warEntry.clan?.tag || clanTag);
        const url = `/api/war/${encodeURIComponent(warId)}/details${normalizedClanTag ? `?clanTag=${encodeURIComponent(normalizedClanTag)}` : ''}`;
        console.log('[DiscordPublisher] Fetching war details from database', { warId, normalizedClanTag, url });
        
        const response = await fetch(url);
        if (!response.ok) {
          console.log('[DiscordPublisher] War details API returned error', {
            status: response.status,
            statusText: response.statusText,
          });
          // No detailed data available, use summary
          setEnrichedWarEntry(warEntry);
          setIsEnriching(false);
          return;
        }

        const result = await response.json();
        console.log('[DiscordPublisher] War details API response', {
          success: result.success,
          memberCount: result.data?.members?.length || 0,
        });

        if (result.success && result.data?.members?.length) {
          // Enrich the war entry with member attack data
          console.log('[DiscordPublisher] Enriching war entry with database member data', {
            memberCount: result.data.members.length,
          });
          setEnrichedWarEntry({
            ...warEntry,
            clan: {
              ...warEntry.clan,
              members: result.data.members,
            },
          });
        } else {
          console.log('[DiscordPublisher] No member data in database response, using summary only');
          setEnrichedWarEntry(warEntry);
        }
        setIsEnriching(false);
      } catch (error) {
        console.warn('[DiscordPublisher] Failed to fetch war details', error);
        setEnrichedWarEntry(warEntry);
        setIsEnriching(false);
      }
    };

    fetchWarDetails();
  }, [warEntry, currentWar, clanData, clanTag]);

  const warResultBase = useMemo<WarResultPayload | null>(() => {
    if (!warEntry) return null;
    const ourClan = warEntry.clan || {};
    const opponentClan = warEntry.opponent || {};
    const parsePercentValue = (value: any): number | undefined => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const normalizedResultRaw = (warEntry.result || '').toString().toLowerCase();
    let normalizedResult: 'win' | 'loss' | 'draw' = 'draw';
    if (normalizedResultRaw.includes('win')) {
      normalizedResult = 'win';
    } else if (normalizedResultRaw.includes('lose') || normalizedResultRaw.includes('loss')) {
      normalizedResult = 'loss';
    }
    const derivedClanTag =
      normalizeTag((clanData as any)?.clanTag || ourClan.tag || clanTag) || clanTag;

    return {
      clanName: clanData?.clanName || ourClan.name || 'Our Clan',
      clanTag: derivedClanTag,
      opponentName: opponentClan.name || warEntry.opponentName || 'Opponent',
      opponentTag: opponentClan.tag || warEntry.opponentTag || 'Unknown',
      ourStars: Number(ourClan.stars ?? 0),
      opponentStars: Number(opponentClan.stars ?? 0),
      ourPercent: parsePercentValue(ourClan.destructionPercentage ?? ourClan.destruction),
      opponentPercent: parsePercentValue(opponentClan.destructionPercentage ?? opponentClan.destruction),
      result: normalizedResult,
      warType: warEntry.teamSize ? `${warEntry.teamSize}v${warEntry.teamSize}` : undefined,
      warId: warEntry.warId || warEntry.endTime || undefined,
    };
  }, [warEntry, clanData, clanTag]);

  useEffect(() => {
    if (!warResultBase) return;
    setHasUserOverriddenLearnings(false);
    hasUserOverriddenLearningsRef.current = false;
    lastAutoLearningsRef.current = "";
    setAiLearningsState({ status: 'idle', signature: null, error: null });
    pendingAiTokenRef.current = null;
    lastCompletedAiTokenRef.current = null;
    setAiRequestNonce((token) => token + 1);
  }, [warResultBase?.warId]);

  const autoWarNotes = useMemo(() => {
    const notes = deriveWarResultNotes(enrichedWarEntry, warResultBase);
    console.log('[DiscordPublisher] Auto war notes derived', {
      hasNotes: !!notes,
      hasMVP: !!notes?.mvp,
      mvpName: notes?.mvp?.name,
      mvpTag: notes?.mvp?.tag,
      mvpStars: notes?.mvp?.stars,
      hasBravest: !!notes?.bravest,
      bravestName: notes?.bravest?.name,
      bravestTag: notes?.bravest?.tag,
      bravestStars: notes?.bravest?.stars,
      topPerformersCount: notes?.topPerformers?.length || 0,
      topPerformers: notes?.topPerformers?.map(p => ({ name: p.name, tag: p.tag, stars: p.stars })),
      learningsCount: notes?.learnings?.length || 0,
      learnings: notes?.learnings,
    });
    return notes;
  }, [enrichedWarEntry, warResultBase]);
  const aiWarPayload = useMemo(() => {
    if (!warResultBase || !autoWarNotes) return null;
    const normalizePerformer = (perf?: AutoWarPerformer | null): AiWarPerformerPayload | null => {
      if (!perf) return null;
      return {
        name: perf.name,
        tag: perf.tag ?? undefined,
        stars: perf.totalStars ?? perf.stars ?? undefined,
        summary: perf.summary,
        townHallDelta: computeTownHallDelta(perf.braveryAttack ?? null) || undefined,
      };
    };
    return {
      clanTag: warResultBase.clanTag,
      clanName: warResultBase.clanName,
      war: {
        opponentName: warResultBase.opponentName,
        opponentTag: warResultBase.opponentTag,
        result: warResultBase.result,
        ourStars: warResultBase.ourStars,
        opponentStars: warResultBase.opponentStars,
        ourPercent: warResultBase.ourPercent,
        opponentPercent: warResultBase.opponentPercent,
        warType: warResultBase.warType,
        warId: warResultBase.warId,
      },
      topPerformers: ((autoWarNotes.topPerformers || []).map(normalizePerformer).filter(Boolean) ||
        []) as AiWarPerformerPayload[],
      bravest: normalizePerformer(autoWarNotes.bravest || undefined) || undefined,
      rosterContext: rosterContext || undefined,
    };
  }, [warResultBase, autoWarNotes, rosterContext]);
  const aiWarPayloadSignature = useMemo(
    () => (aiWarPayload ? JSON.stringify(aiWarPayload) : null),
    [aiWarPayload]
  );
  const aiEffectKey = aiWarPayloadSignature ? `${aiWarPayloadSignature}:${aiRequestNonce}` : null;

  const lastScheduledAiTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!aiEffectKey || !aiWarPayload || !aiWarPayloadSignature) return;
    if (hasUserOverriddenLearnings) return;

    const token = aiEffectKey;
    if (lastCompletedAiTokenRef.current === token || pendingAiTokenRef.current === token) {
      return;
    }

    lastScheduledAiTokenRef.current = token;
    const timeoutId = setTimeout(() => {
      if (lastScheduledAiTokenRef.current !== token) return;
      pendingAiTokenRef.current = token;
      let cancelled = false;

      const fetchAiSummary = async () => {
        try {
          setAiLearningsState({ status: 'loading', signature: aiWarPayloadSignature, error: null });
          const response = await api.generateWarSummary(aiWarPayload);
          if (cancelled) return;
          const aiLines =
            response?.success && Array.isArray(response?.data?.learnings)
              ? response.data.learnings
              : [];
          const cleanedLines = cleanAiLines(aiLines);
          if (cleanedLines.length && !hasUserOverriddenLearningsRef.current) {
            const aiText = cleanedLines.join('\n');
            lastAutoLearningsRef.current = aiText;
            setWarResultNotes((prev) => ({ ...prev, learningsText: aiText }));
            setHasUserOverriddenLearnings(false);
            hasUserOverriddenLearningsRef.current = false;
          }
          setAiLearningsState({ status: 'success', signature: aiWarPayloadSignature, error: null });
          lastCompletedAiTokenRef.current = token;
        } catch (error: any) {
          if (cancelled) return;
          setAiLearningsState({
            status: 'error',
            signature: aiWarPayloadSignature,
            error: error?.message ?? 'Failed to generate AI learnings',
          });
        } finally {
          pendingAiTokenRef.current = null;
          if (lastScheduledAiTokenRef.current === token) {
            lastScheduledAiTokenRef.current = null;
          }
        }
      };

      fetchAiSummary();
      return () => {
        cancelled = true;
      };
    }, 600);

    return () => {
      if (lastScheduledAiTokenRef.current === token) {
        clearTimeout(timeoutId);
        lastScheduledAiTokenRef.current = null;
      }
    };
  }, [aiEffectKey, aiWarPayload, aiWarPayloadSignature, hasUserOverriddenLearnings]);

  useEffect(() => {
    console.log('[DiscordPublisher] Auto-fill effect triggered', {
      hasAutoWarNotes: !!autoWarNotes,
      isEnriching,
    });

    // Don't auto-fill while enrichment is in progress
    if (isEnriching) {
      console.log('[DiscordPublisher] Enrichment in progress, skipping auto-fill');
      return;
    }

    if (!autoWarNotes) {
      console.log('[DiscordPublisher] No auto war notes, skipping auto-fill');
      return;
    }

    let appliedLearnings = false;

    setWarResultNotes((prev) => {
      console.log('[DiscordPublisher] Auto-filling war result notes', {
        mvpName: autoWarNotes.mvp?.name,
        bravestName: autoWarNotes.bravest?.name,
        learningsCount: autoWarNotes.learnings?.length,
      });
      let changed = false;
      const next: WarResultNotes = { ...prev };

      const setIfEmpty = (field: keyof Omit<WarResultNotes, 'topPerformers'>, value?: string | null) => {
        if (!value) return;
        const trimmed = value.trim();
        if (!trimmed) return;
        if (!prev[field].trim()) {
          next[field] = trimmed;
          changed = true;
        }
      };

      const setNumberIfEmpty = (field: keyof Omit<WarResultNotes, 'topPerformers'>, value?: number) => {
        if (value == null || Number.isNaN(value)) return;
        const currentValue = prev[field];
        if (typeof currentValue === 'string' && !currentValue.trim()) {
          next[field] = String(value) as any;
          changed = true;
        }
      };

      setIfEmpty('mvpName', autoWarNotes.mvp?.name ?? null);
      setIfEmpty('mvpTag', autoWarNotes.mvp?.tag ?? null);
      setNumberIfEmpty('mvpStars', autoWarNotes.mvp?.stars);
      setIfEmpty('mvpSummary', autoWarNotes.mvp?.summary ?? null);

      let topPerformersUpdated = false;
      const updatedPerformers = prev.topPerformers.map((entry, index) => {
        const auto = autoWarNotes.topPerformers[index];
        if (!auto) return entry;
        const hasInput =
          entry.name.trim() ||
          entry.tag.trim() ||
          entry.stars.trim() ||
          entry.summary.trim();
        if (hasInput) return entry;
        topPerformersUpdated = true;
        return {
          name: auto.name,
          tag: auto.tag ?? '',
          stars: auto.stars != null ? String(auto.stars) : '',
          summary: auto.summary ?? '',
        };
      });
      if (topPerformersUpdated) {
        next.topPerformers = updatedPerformers;
        changed = true;
      }

      setIfEmpty('bravestName', autoWarNotes.bravest?.name ?? null);
      setIfEmpty('bravestTag', autoWarNotes.bravest?.tag ?? null);
      setNumberIfEmpty('bravestStars', autoWarNotes.bravest?.stars);
      setIfEmpty('bravestSummary', autoWarNotes.bravest?.summary ?? null);

      if (autoWarNotes.learnings?.length && !hasUserOverriddenLearnings) {
        const heuristicsText = autoWarNotes.learnings.join('\n');
        if (next.learningsText !== heuristicsText) {
          next.learningsText = heuristicsText;
          appliedLearnings = true;
          changed = true;
        }
      }

      if (changed) {
        console.log('[DiscordPublisher] War result notes updated', {
          mvpName: next.mvpName,
          mvpTag: next.mvpTag,
          mvpStars: next.mvpStars,
          mvpSummary: next.mvpSummary,
          bravestName: next.bravestName,
          bravestTag: next.bravestTag,
          bravestStars: next.bravestStars,
          bravestSummary: next.bravestSummary,
          topPerformersCount: next.topPerformers.filter(p => p.name || p.tag).length,
          learningsLength: next.learningsText.length,
          learningsPreview: next.learningsText.substring(0, 100),
        });
      } else {
        console.log('[DiscordPublisher] No changes to war result notes (fields already filled)', {
          currentMVPName: prev.mvpName,
          currentBravestName: prev.bravestName,
          currentLearningsLength: prev.learningsText.length,
        });
      }
      return changed ? next : prev;
    });
    if (appliedLearnings) {
      lastAutoLearningsRef.current = autoWarNotes.learnings!.join('\n');
      setHasUserOverriddenLearnings(false);
      hasUserOverriddenLearningsRef.current = false;
    }
  }, [autoWarNotes, isEnriching, hasUserOverriddenLearnings]);

  const buildWarResultPayload = (): WarResultPayload | null => {
    if (!warResultBase) return null;
    const normalizeOptionalTag = (value: string): string | undefined => {
      const normalized = normalizeTag(value);
      if (normalized) return normalized;
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    };
    const parseStarsValue = (value: string): number | undefined => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const mvpName = warResultNotes.mvpName.trim();
    const mvp =
      mvpName.length > 0
        ? {
            name: mvpName,
            tag: normalizeOptionalTag(warResultNotes.mvpTag),
            stars: parseStarsValue(warResultNotes.mvpStars),
            summary: warResultNotes.mvpSummary.trim() || undefined,
          }
        : null;

    const topPerformers = warResultNotes.topPerformers
      .map((perf) => ({
        name: perf.name.trim(),
        tag: normalizeOptionalTag(perf.tag),
        stars: parseStarsValue(perf.stars),
        summary: perf.summary.trim() || undefined,
      }))
      .filter((perf) => perf.name.length > 0);

    const bravestName = warResultNotes.bravestName.trim();
    const bravest =
      bravestName.length > 0
        ? {
            name: bravestName,
            tag: normalizeOptionalTag(warResultNotes.bravestTag),
            stars: parseStarsValue(warResultNotes.bravestStars),
            summary: warResultNotes.bravestSummary.trim() || undefined,
          }
        : null;

    const learnings = warResultNotes.learningsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const parts = line.split(' - ');
        if (parts.length > 1) {
          const [title, ...rest] = parts;
          const detail = rest.join(' - ').trim();
          return {
            title: title.trim() || `Learning ${index + 1}`,
            detail: detail || title.trim(),
          };
        }
        return {
          title: `Learning ${index + 1}`,
          detail: line,
        };
      });

    return {
      ...warResultBase,
      mvp,
      topPerformers: topPerformers.length ? topPerformers : undefined,
      bravest,
      learnings: learnings.length ? learnings : undefined,
    };
  };

  const generateExhibitMessage = (): string => {
    switch (selectedExhibit) {
      case "rushed":
        return generateRushedExhibit();
      case "donations":
        return generateDonationExhibit();
      case "activity":
        return generateActivityExhibit();
      case "war":
        return generateWarReport();
      case "war-result": {
        const payload = buildWarResultPayload();
        return payload ? formatWarResultForDiscord(payload) : "";
      }
      default:
        return "";
    }
  };

  const publishToDiscord = async () => {
    if (!webhookUrl) {
      alert("Please configure your Discord webhook URL first!");
      return;
    }

    const message = generateExhibitMessage();
    if (!message) {
      alert("No data available to generate exhibit!");
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch('/api/discord/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          message,
          exhibitType: selectedExhibit,
          clanTag
        })
      });

      if (response.ok) {
        alert("Exhibit published to Discord successfully!");
      } else {
        const error = await response.text();
        alert(`Failed to publish: ${error}`);
      }
    } catch (error) {
      console.error('Discord publish error:', error);
      alert("Failed to publish to Discord. Please check your webhook URL.");
    } finally {
      setIsPublishing(false);
    }
  };

  const updatePreview = () => {
    setPreviewMessage(generateExhibitMessage());
  };

  useEffect(() => {
    if (clanData) {
      setPreviewMessage(generateExhibitMessage());
    } else {
      setPreviewMessage('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clanData, selectedExhibit, warPlanSummary, warResultNotes]);

  if (!clanData) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Load clan data to access Discord publishing features</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-800">Discord Publisher</h2>
            </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Configure Discord webhook"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="font-semibold text-gray-800 mb-3">Discord Webhook Configuration</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => saveWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-600">
              💡 Get your webhook URL from Discord Server Settings → Integrations → Webhooks
            </p>
          </div>
        </div>
      )}

      {/* Exhibit Selection */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Select Exhibit to Publish</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <button
            onClick={() => { setSelectedExhibit("rushed"); updatePreview(); }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedExhibit === "rushed" 
                ? "border-red-500 bg-red-50 text-red-700" 
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}
          >
            <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">Rush Analysis</div>
            <div className="text-sm opacity-75">Identify rushed players</div>
          </button>
          
          <button
            onClick={() => { setSelectedExhibit("donations"); updatePreview(); }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedExhibit === "donations" 
                ? "border-green-500 bg-green-50 text-green-700" 
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}
          >
            <Users className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">Donation Report</div>
            <div className="text-sm opacity-75">Top & low donators</div>
          </button>
          
          <button
            onClick={() => { setSelectedExhibit("activity"); updatePreview(); }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedExhibit === "activity" 
                ? "border-blue-500 bg-blue-50 text-blue-700" 
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}
          >
            <TrendingUp className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">Activity Report</div>
            <div className="text-sm opacity-75">Member activity status</div>
          </button>

          <button
            onClick={() => { setSelectedExhibit("war"); updatePreview(); }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedExhibit === "war" 
                ? "border-purple-500 bg-purple-50 text-purple-700" 
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}
          >
            <Swords className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">War Report</div>
            <div className="text-sm opacity-75">Current war & recent results</div>
          </button>

          <button
            onClick={() => { setSelectedExhibit("war-result"); updatePreview(); }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedExhibit === "war-result" 
                ? "border-yellow-500 bg-yellow-50 text-yellow-700" 
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}
          >
            <Trophy className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">War Result</div>
            <div className="text-sm opacity-75">Scoreline, MVP, learnings</div>
          </button>
        </div>
      </div>

      {selectedExhibit === "war-result" && (
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">War Result Configuration</h3>
            <p className="text-sm text-gray-500">Use your #🏅-war-results webhook for this exhibit.</p>
          </div>
          {!warResultBase ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No completed wars were detected in the latest snapshot. Refresh your clan data after a war ends to enable
              this exhibit.
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                <p className="font-semibold text-lg">
                  {warResultBase.clanName} {warResultBase.ourStars}-{warResultBase.opponentStars} {warResultBase.opponentName}
                </p>
                <p className="mt-1">
                  <span className="font-semibold">Result:</span>{' '}
                  {warResultBase.result === 'win' ? 'Victory' : warResultBase.result === 'loss' ? 'Defeat' : 'Draw'}
                </p>
                {warResultBase.ourPercent != null && warResultBase.opponentPercent != null && (
                  <p>
                    <span className="font-semibold">Destruction:</span>{' '}
                    {warResultBase.ourPercent.toFixed(1)}% vs {warResultBase.opponentPercent.toFixed(1)}%
                  </p>
                )}
                {warResultBase.warType && (
                  <p>
                    <span className="font-semibold">Format:</span> {warResultBase.warType}
                  </p>
                )}
                {warResultBase.warId && (
                  <p>
                    <span className="font-semibold">War ID:</span> {warResultBase.warId}
                  </p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h4 className="font-semibold text-gray-800">MVP (optional)</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      value={warResultNotes.mvpName}
                      onChange={(e) => updateWarResultField('mvpName', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tag</label>
                      <input
                        type="text"
                        value={warResultNotes.mvpTag}
                        onChange={(e) => updateWarResultField('mvpTag', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="#XXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Stars</label>
                      <input
                        type="number"
                        min="0"
                        max="6"
                        value={warResultNotes.mvpStars}
                        onChange={(e) => updateWarResultField('mvpStars', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Summary</label>
                    <textarea
                      value={warResultNotes.mvpSummary}
                      onChange={(e) => updateWarResultField('mvpSummary', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="e.g., 6 stars, clutch cleanup in slot 5"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h4 className="font-semibold text-gray-800">Bravest Attack (optional)</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      value={warResultNotes.bravestName}
                      onChange={(e) => updateWarResultField('bravestName', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tag</label>
                      <input
                        type="text"
                        value={warResultNotes.bravestTag}
                        onChange={(e) => updateWarResultField('bravestTag', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="#XXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Stars</label>
                      <input
                        type="number"
                        min="0"
                        max="6"
                        value={warResultNotes.bravestStars}
                        onChange={(e) => updateWarResultField('bravestStars', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Summary</label>
                    <textarea
                      value={warResultNotes.bravestSummary}
                      onChange={(e) => updateWarResultField('bravestSummary', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="e.g., saved the war with a TH17 dip triple"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Top Performers (optional)</h4>
                  <div className="space-y-3">
                    {warResultNotes.topPerformers.map((performer, index) => (
                      <div key={index} className="rounded-lg border border-gray-200 p-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Performer #{index + 1}</p>
                        <div className="grid md:grid-cols-4 gap-3">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600">Name</label>
                            <input
                              type="text"
                              value={performer.name}
                              onChange={(e) => updateTopPerformer(index, 'name', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Player name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600">Tag</label>
                            <input
                              type="text"
                              value={performer.tag}
                              onChange={(e) => updateTopPerformer(index, 'tag', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="#XXXXXXX"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600">Stars</label>
                            <input
                              type="number"
                              min="0"
                              max="6"
                              value={performer.stars}
                              onChange={(e) => updateTopPerformer(index, 'stars', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-600">Highlight</label>
                          <input
                            type="text"
                            value={performer.summary}
                            onChange={(e) => updateTopPerformer(index, 'summary', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., cleaned slot 3 with 3★"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="font-semibold text-gray-800">Learnings & Takeaways</h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      {aiLearningsState.status === 'loading' && (
                        <span className="text-purple-600">AI summarizing…</span>
                      )}
                      {aiLearningsState.status === 'error' && (
                        <button
                          type="button"
                          onClick={requestAiLearnings}
                          className="text-red-600 hover:underline"
                        >
                          Retry AI summary
                        </button>
                      )}
                      {hasUserOverriddenLearnings && (
                        <button
                          type="button"
                          onClick={restoreAiLearnings}
                          className="text-blue-600 hover:underline"
                        >
                          Use AI summary
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={warResultNotes.learningsText}
                    onChange={(e) => handleLearningsChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder={"Example:\nEarly aggression - Secure triples in slots 2-4\nTown Hall 17 prep - Practice QCL combos"}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter one learning per line. Lines with “Title - detail” will be formatted together.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Preview */}
      {previewMessage && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Preview</h3>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(previewMessage);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch (err) {
                  console.error('Failed to copy:', err);
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
              title="Copy message to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
            {previewMessage}
          </div>
        </div>
      )}

      {/* Publish Button */}
      <div className="flex justify-end">
        <button
          onClick={publishToDiscord}
          disabled={!webhookUrl || !previewMessage || isPublishing}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
        >
          {isPublishing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Publishing...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Publish to Discord
            </>
          )}
        </button>
      </div>
    </div>
  );
}
