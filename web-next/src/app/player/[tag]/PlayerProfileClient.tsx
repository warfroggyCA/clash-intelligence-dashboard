"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import useSWR from 'swr';
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Clipboard,
  Coins,
  ExternalLink,
  Flame,
  Landmark,
  Hammer,
  History,
  Medal,
  PawPrint,
  Plus,
  Sparkles,
  SquarePen,
  Target,
  Trophy,
  UserCheck,
  UserPlus,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Users,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { normalizeTag } from "@/lib/tags";
import { compareRankedLeagues } from "@/lib/league-tiers";
import { fetchPlayerProfileSupabase } from "@/lib/player-profile-supabase";
import type { SupabasePlayerProfilePayload } from "@/types/player-profile-supabase";
import { useLeadership } from "@/hooks/useLeadership";
import { useDashboardStore, selectors } from "@/lib/stores/dashboard-store";
import { useShallow } from 'zustand/react/shallow';
import { getMemberActivity } from '@/lib/business/calculations';
import { cfg } from "@/lib/config";
import { showToast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import { Modal } from "@/components/ui/Modal";
import { LeagueBadge, TownHallBadge } from "@/components/ui";
import TrophyChart from "@/components/player/TrophyChart";
import DonationChart from "@/components/player/DonationChart";
import PlayerActivityAnalytics from "@/components/player/PlayerActivityAnalytics";
import PlayerDNARadar from "@/components/PlayerDNARadar";
import StatsRadarChart from "@/components/player/StatsRadarChart";
import PlayerComparisonView from "@/components/player/PlayerComparisonView";
import { calculatePlayerDNA, classifyPlayerArchetype, calculateClanDNA } from "@/lib/player-dna";
import { generateDNABreakdown } from "@/lib/player-dna-breakdown";
import { HERO_MAX_LEVELS, EQUIPMENT_MAX_LEVELS, EQUIPMENT_NAME_ALIASES, type Member } from "@/types";
import { HeroLevel } from "@/components/ui";
import { getRoleBadgeVariant } from "@/lib/leadership";
import Image from "next/image";
import { PlayerProfileSkeleton } from "@/components/ui/PlayerProfileSkeleton";
import { ErrorDisplay, categorizeError } from "@/components/ui/ErrorDisplay";
import { playerProfileFetcher } from "@/lib/api/swr-fetcher";
import { playerProfileSWRConfig } from "@/lib/api/swr-config";

const DashboardLayout = dynamic(() => import("@/components/layout/DashboardLayout"), {
  ssr: false,
});

type TabKey = "overview" | "history" | "evaluations" | "metrics" | "analysis" | "comparison";

type TimelineTone = "default" | "positive" | "warning";

interface TimelineItem {
  id: string;
  date: string;
  title: string;
  description?: string;
  tone: TimelineTone;
  icon:
    | "join"
    | "depart"
    | "return"
    | "tenure"
    | "warning"
    | "note"
    | "joiner"
    | "upgrade"
    | "hero"
    | "pet"
    | "equipment"
    | "league"
    | "trophy"
    | "capital"
    | "donation"
    | "legend"
    | "highlight"
    | "war"
    | "builder";
}

interface PlayerProfileClientProps {
  tag: string;
  initialProfile?: SupabasePlayerProfilePayload | null;
}

const formatNumber = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat().format(Number(value));
};

const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(0)}%`;
};

const formatSignedNumber = (value: number) => (value > 0 ? `+${formatNumber(value)}` : formatNumber(value));

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? parseISO(value) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("invalid");
    return format(date, "MMM d, yyyy");
  } catch {
    return "—";
  }
};

const formatRelative = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    const date = typeof value === "string" ? parseISO(value) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("invalid");
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return null;
  }
};

const timelineIconClass = (tone: TimelineTone) => {
  switch (tone) {
    case "positive":
      return "bg-emerald-600/90 border-emerald-400/80 text-white shadow-[0_8px_16px_-10px_rgba(16,185,129,0.7)]";
    case "warning":
      return "bg-amber-600/90 border-amber-400/80 text-white shadow-[0_8px_16px_-10px_rgba(251,191,36,0.75)]";
    default:
      return "bg-slate-800/90 border-slate-600/70 text-slate-100 shadow-[0_8px_16px_-10px_rgba(148,163,184,0.5)]";
  }
};

const TimelineIcon = ({ type }: { type: TimelineItem["icon"] }) => {
  const size = "w-4 h-4";
  switch (type) {
    case "join":
      return <UserPlus className={size} />;
    case "depart":
      return <ArrowRight className={size} />;
    case "return":
      return <ArrowLeft className={size} />;
    case "tenure":
      return <UserCheck className={size} />;
    case "warning":
      return <AlertTriangle className={size} />;
    case "note":
      return <SquarePen className={size} />;
    case "joiner":
      return <Sparkles className={size} />;
    case "upgrade":
      return <Hammer className={size} />;
    case "hero":
      return <Sparkles className={size} />;
    case "pet":
      return <PawPrint className={size} />;
    case "equipment":
      return <Sparkles className={size} />;
    case "league":
      return <Activity className={size} />;
    case "trophy":
      return <Trophy className={size} />;
    case "capital":
      return <Coins className={size} />;
    case "donation":
      return <Coins className={size} />;
    case "legend":
      return <Flame className={size} />;
    case "builder":
      return <Hammer className={size} />;
    case "highlight":
      return <Sparkles className={size} />;
    case "war":
      return <Medal className={size} />;
    default:
      return <History className={size} />;
  }
};

const HERO_DISPLAY_NAMES: Record<string, string> = {
  bk: "Barbarian King",
  aq: "Archer Queen",
  gw: "Grand Warden",
  rc: "Royal Champion",
  mp: "Minion Prince",
};

type MilestoneKind = "hero" | "donation" | "capital" | "war" | "legend" | "builder" | "league";

interface MilestoneHighlight {
  id: string;
  kind: MilestoneKind;
  title: string;
  detail: string;
  dateIso: string;
  dateDisplay: string;
}

const EQUIPMENT_TOOLTIPS: Record<string, { hero: string; description: string; rarity: string; tier: string }> = {
  "Giant Gauntlet": {
    hero: "Barbarian King",
    description: "Transforms the King massive for 17 seconds, granting extra area damage, increased health, and self-healing capabilities.",
    rarity: "Epic",
    tier: "A Tier"
  },
  "Eternal Tome": {
    hero: "Grand Warden",
    description: "Grants the Warden and nearby troops immunity to damage for up to 8.2 seconds when fully upgraded.",
    rarity: "Common (Max Lvl 18)",
    tier: "S Tier"
  },
  "Archer Puppet": {
    hero: "Archer Queen",
    description: "Brings out 35 invisible Archers during fights; noted for low attack power and duration.",
    rarity: "Common (Max Lvl 18)",
    tier: "C Tier"
  },
  "Barbarian Puppet": {
    hero: "Barbarian King",
    description: "Summons a swarm of Barbarians; provides satisfactory health regeneration and a commendable Hitpoint boost.",
    rarity: "Common (Max Lvl 18)",
    tier: "C Tier"
  },
  "Invisibility Vial": {
    hero: "Archer Queen",
    description: "Makes the Archer Queen invisible to enemies, allowing her to land heavy hits and restoring some health.",
    rarity: "Common (Max Lvl 18)",
    tier: "B Tier"
  },
  "Life Gem": {
    hero: "Grand Warden",
    description: "Blesses nearby allies with extra HP (1,025 extra HP per unit after buff).",
    rarity: "Common (Max Lvl 18)",
    tier: "C Tier"
  },
  "Fireball": {
    hero: "Grand Warden",
    description: "An active ability that can kill enemy heroes and destroy specific areas of the base using a powerful projectile.",
    rarity: "Epic gear",
    tier: "S Tier"
  },
  "Vampstache": {
    hero: "Barbarian King",
    description: "Recovers 300 Hitpoints for the King per attack, providing self-sustaining capability.",
    rarity: "Common (Max Lvl 18)",
    tier: "A Tier"
  },
  "Royal Gem": {
    hero: "Royal Champion",
    description: "Only used to restore HP for the Royal Champion; considered situational.",
    rarity: "Common (Max Lvl 18)",
    tier: "D Tier"
  },
  "Seeking Shield": {
    hero: "Royal Champion",
    description: "Throws her shield at four targets, allowing players to eliminate defenses selectively.",
    rarity: "Common (Max Lvl 18)",
    tier: "A Tier"
  },
  "Rage Vial": {
    hero: "Barbarian King",
    description: "Makes the King enraged for 10 seconds, granting a damage boost, increased speed, and health regeneration.",
    rarity: "Common (Max Lvl 18)",
    tier: "B Tier"
  },
  "Healer Puppet": {
    hero: "Archer Queen",
    description: "Allows three Healers to back up the Queen, gradually restoring her HP and extending her life span.",
    rarity: "Common (Max Lvl 18)",
    tier: "A Tier"
  },
  "Dark Orb": {
    hero: "Minion Prince",
    description: "Throws projectiles that damage and slow down defensive buildings in the enemy base.",
    rarity: "Common (Max Lvl 18)",
    tier: "S Tier"
  },
  "Rage Gem": {
    hero: "Grand Warden",
    description: "Creates an aura allowing nearby team troops to deal extra damage; works well with air armies.",
    rarity: "Common (Max Lvl 18)",
    tier: "B Tier"
  },
  "Noble Iron": {
    hero: "Minion Prince",
    description: "Increases the Prince's range and power, letting him deal 770 extra damage quickly at the start.",
    rarity: "Common (Max Lvl 18)",
    tier: "A Tier"
  },
  "Giant Arrow": {
    hero: "Archer Queen",
    description: "Active ability for the Queen to clear airbases and other building troops.",
    rarity: "Common (Max Lvl 18)",
    tier: "A Tier"
  },
  "Metal Pants": {
    hero: "Minion Prince",
    description: "Provides a 70% damage reduction for 15 seconds.",
    rarity: "Common (Max Lvl 18)",
    tier: "B Tier"
  },
  "Healing Tome": {
    hero: "Grand Warden",
    description: "Heals the Warden and nearby troops for 20 seconds with 150 HP/s, offering exceptional and consistent healing.",
    rarity: "Common (Max Lvl 18)",
    tier: "S Tier"
  },
  "Heroic Torch": {
    hero: "Grand Warden",
    description: "Allows nearby troops to jump over walls, move faster, and attack more effectively for 11 to 20 seconds.",
    rarity: "Common",
    tier: "C Tier"
  },
  "Henchmen Puppet": {
    hero: "Minion Prince",
    description: "Drops two puppets to aid in battle and grants the Prince brief invisibility.",
    rarity: "Common (Max Lvl 18)",
    tier: "A Tier"
  },
  "Earthquake Boots": {
    hero: "Barbarian King",
    description: "Creates an earthquake strong enough to bring down walls and buildings quickly.",
    rarity: "Common (Max Lvl 18)",
    tier: "S Tier"
  },
  "Hog Rider Puppet": {
    hero: "Royal Champion",
    description: "Summons nine Hog Riders as duelists to soak damage while the RC is invisible.",
    rarity: "Common (Max Lvl 18)",
    tier: "A Tier"
  },
  "Lavaloon Puppet": {
    hero: "Barbarian King",
    description: "Summons Lava Hounds and Balloons to support the King in battle.",
    rarity: "Common (Max Lvl 18)",
    tier: "A Tier"
  },
  "Rocket Spear": {
    hero: "Royal Champion",
    description: "Throws a powerful spear that deals massive damage to defensive buildings.",
    rarity: "Epic",
    tier: "S Tier"
  },
  "Frozen Arrow": {
    hero: "Archer Queen",
    description: "Fires an arrow that freezes enemy defenses and buildings, slowing them down significantly.",
    rarity: "Epic",
    tier: "S Tier"
  },
  "Electro Boots": {
    hero: "Royal Champion",
    description: "Charges the Royal Champion with electricity, dealing chain lightning damage to nearby enemies.",
    rarity: "Epic",
    tier: "S Tier"
  },
  "Meteor Staff": {
    hero: "Minion Prince",
    description: "Periodically summons meteors that target the nearest defensive building, dealing area damage to both ground and air units. Enhances the Prince's offensive capabilities, damage, and hitpoints.",
    rarity: "Epic",
    tier: "S Tier"
  },
  "Spiky Ball": {
    hero: "Barbarian King",
    description: "Throws a spiky ball that deals damage and bounces between targets.",
    rarity: "Epic",
    tier: "A Tier"
  },
  "Dark Crown": {
    hero: "Minion Prince",
    description: "Enhances the Minion Prince's abilities with dark magic, increasing damage and survivability.",
    rarity: "Epic",
    tier: "A Tier"
  },
  "Action Figure": {
    hero: "Minion Prince",
    description: "Summons animated figures to aid in battle.",
    rarity: "Epic",
    tier: "B Tier"
  },
  "Haste Vial": {
    hero: "Royal Champion",
    description: "Grants increased movement and attack speed for a duration.",
    rarity: "Common (Max Lvl 18)",
    tier: "B Tier"
  },
  "Magic Mirror": {
    hero: "Archer Queen",
    description: "Allows the Archer Queen to summon clones of herself during her ability, providing strategic advantages in battles.",
    rarity: "Epic",
    tier: "A Tier"
  }
};

const toNumericDelta = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
  }
  return null;
};

const toNumberValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toTitleCase = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

type TimelinePoint = SupabasePlayerProfilePayload["timeline"][number];

const buildStatsContext = (point: TimelinePoint, usedDeltaKeys: Set<string>): string | null => {
  const stats: string[] = [];
  if (!usedDeltaKeys.has("trophies") && point.trophies != null) {
    stats.push(`Trophies ${formatNumber(point.trophies)}`);
  }
  if (!usedDeltaKeys.has("donations") && point.donations != null) {
    stats.push(`Donations ${formatNumber(point.donations)}`);
  }
  if (!usedDeltaKeys.has("donations_rcv") && point.donationsReceived != null) {
    stats.push(`Received ${formatNumber(point.donationsReceived)}`);
  }
  if (!usedDeltaKeys.has("war_stars") && point.warStars != null) {
    stats.push(`War stars ${formatNumber(point.warStars)}`);
  }
  if (!usedDeltaKeys.has("capital_contrib") && point.capitalContributions != null) {
    stats.push(`Capital ${formatNumber(point.capitalContributions)}`);
  }
  if (!stats.length) return null;
  return `Totals — ${stats.join(" • ")}`;
};

const summarizeEquipment = (levels: Record<string, number> | null | undefined, slice = 3) => {
  if (!levels || typeof levels !== "object") return null;
  const entries = Object.entries(levels)
    .filter(([, value]) => typeof value === "number")
    .sort((a, b) => Number(b[1] ?? 0) - Number(a[1] ?? 0))
    .slice(0, slice);

  if (!entries.length) return null;

  return entries
    .map(([name, level]) => `${toTitleCase(name)} ${formatNumber(Number(level))}`)
    .join(", ");
};

const buildEventFallbackDescriptions = (
  point: TimelinePoint,
  primaryEvent: string,
  otherEventLabels: string[],
  enrichedDeltas: Record<string, number>,
): string[] => {
  const fallback: string[] = [];

  switch (primaryEvent) {
    case "donations_threshold": {
      const delta = enrichedDeltas.donations ?? enrichedDeltas.donation_delta;
      const total = point.donations != null ? formatNumber(point.donations) : null;
      if (delta != null && total) {
        fallback.push(`Donated ${formatSignedNumber(delta)} troops today (total ${total})`);
      } else if (total) {
        fallback.push(`Donations milestone reached at ${total} troops given`);
      } else {
        fallback.push("Donations milestone reached");
      }
      break;
    }
    case "equipment_upgrade": {
      const summary = summarizeEquipment(point.equipmentLevels);
      fallback.push(summary ? `Equipment loadout updated (${summary})` : "Equipment loadout updated");
      break;
    }
    case "pet_level_up": {
      const summary = summarizeEquipment(point.petLevels);
      fallback.push(summary ? `Pet roster advanced (${summary})` : "Pet roster advanced");
      break;
    }
    case "hero_level_up": {
      const summary = summarizeEquipment(point.heroLevels as Record<string, number> | null | undefined);
      fallback.push(summary ? `Hero levels improved (${summary})` : "Hero levels improved");
      break;
    }
    case "th_level_up": {
      if (point.rushPercent != null) {
        fallback.push(`Town Hall upgrade logged (rush score now ${formatPercent(point.rushPercent)})`);
      } else {
        fallback.push("Town Hall upgrade logged");
      }
      break;
    }
    case "war_perf_day": {
      const total = point.warStars != null ? formatNumber(point.warStars) : null;
      fallback.push(total ? `War highlight — ${total} stars on record` : "War highlight recorded");
      break;
    }
    case "war_activity": {
      const warStarDelta =
        typeof enrichedDeltas.war_stars === "number" ? enrichedDeltas.war_stars : null;
      const attackDelta =
        typeof enrichedDeltas.attack_wins === "number" ? enrichedDeltas.attack_wins : null;
      const parts: string[] = [];
      if (warStarDelta) {
        parts.push(`+${formatNumber(warStarDelta)}⭐`);
      }
      if (attackDelta) {
        parts.push(`+${formatNumber(attackDelta)} attack win${attackDelta > 1 ? "s" : ""}`);
      }
      fallback.push(parts.length ? `War activity ${parts.join(" • ")}` : "War activity recorded");
      break;
    }
    case "capital_activity": {
      const total = point.capitalContributions != null ? formatNumber(point.capitalContributions) : null;
      fallback.push(total ? `Capital contributions now ${total}` : "Capital contribution recorded");
      break;
    }
    case "builder_activity": {
      const winsDelta =
        typeof enrichedDeltas.builder_battle_wins === "number"
          ? enrichedDeltas.builder_battle_wins
          : null;
      const hallDelta =
        typeof enrichedDeltas.builder_hall === "number" ? enrichedDeltas.builder_hall : null;
      const trophyDelta =
        typeof enrichedDeltas.builder_trophies === "number"
          ? enrichedDeltas.builder_trophies
          : null;
      const parts: string[] = [];
      if (hallDelta) {
        parts.push(`BH +${formatNumber(Math.abs(hallDelta))}`);
      }
      if (winsDelta) {
        parts.push(`+${formatNumber(winsDelta)} builder wins`);
      }
      if (trophyDelta) {
        parts.push(
          `${trophyDelta > 0 ? "+" : ""}${formatNumber(trophyDelta)} builder trophies`,
        );
      }
      fallback.push(parts.length ? `Builder activity ${parts.join(" • ")}` : "Builder activity recorded");
      break;
    }
    case "legend_activity": {
      fallback.push("Legend League activity logged");
      break;
    }
    case "legend_reentry": {
      fallback.push("Re-entered the Legend League bracket");
      break;
    }
    case "league_change": {
      const leagueName = point.leagueName ?? point.rankedLeagueName ?? null;
      fallback.push(leagueName ? `Moved to ${leagueName}` : "League change recorded");
      break;
    }
    case "trophies_big_delta": {
      const total = point.trophies != null ? formatNumber(point.trophies) : null;
      fallback.push(total ? `Major trophy swing (now ${total})` : "Major trophy swing recorded");
      break;
    }
    default: {
      if (primaryEvent && primaryEvent !== "highlight") {
        fallback.push(`Event tagged: ${toTitleCase(primaryEvent)}`);
      }
      break;
    }
  }

  return fallback;
};

const EVENT_META: Record<string, { title: string; icon: TimelineItem['icon']; tone: TimelineTone }> = {
  th_level_up: { title: "Town Hall upgrade", icon: "upgrade", tone: "positive" },
  hero_level_up: { title: "Hero upgrade", icon: "hero", tone: "positive" },
  pet_level_up: { title: "Pet upgrade", icon: "pet", tone: "positive" },
  equipment_upgrade: { title: "Equipment upgrade", icon: "equipment", tone: "positive" },
  league_change: { title: "League change", icon: "league", tone: "positive" },
  legend_reentry: { title: "Legend League re-entry", icon: "legend", tone: "positive" },
  legend_activity: { title: "Legend League battles", icon: "legend", tone: "positive" },
  trophies_big_delta: { title: "Major trophy swing", icon: "trophy", tone: "positive" },
  war_perf_day: { title: "War highlight", icon: "war", tone: "positive" },
  war_activity: { title: "War activity", icon: "war", tone: "positive" },
  capital_activity: { title: "Capital contribution", icon: "capital", tone: "positive" },
  donations_threshold: { title: "Donation milestone", icon: "donation", tone: "positive" },
  builder_activity: { title: "Builder base push", icon: "builder", tone: "positive" },
};

const DEFAULT_EVENT_META: { title: string; icon: TimelineItem['icon']; tone: TimelineTone } = {
  title: "Daily highlight",
  icon: "highlight",
  tone: "default",
};

function buildTimeline(
  profile: SupabasePlayerProfilePayload | null,
  includeLeadership: boolean,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  const timelinePoints = profile?.timeline ?? [];

  const chronologicalPoints = timelinePoints
    .filter((point): point is TimelinePoint & { snapshotDate: string } => Boolean(point?.snapshotDate))
    .sort((a, b) => {
      const aTime = new Date(a.snapshotDate as string).getTime();
      const bTime = new Date(b.snapshotDate as string).getTime();
      return aTime - bTime;
    });

  chronologicalPoints.forEach((point, index) => {
    const rawEvents = Array.isArray(point.events) ? point.events : [];
    const notability = point.notability ?? 0;
    const previousPoint = index > 0 ? chronologicalPoints[index - 1] : null;

    const rawDeltas =
      point?.deltas && typeof point.deltas === "object" ? (point.deltas as Record<string, unknown>) : {};
    const enrichedDeltas = Object.entries(rawDeltas).reduce((acc, [key, rawValue]) => {
      const numeric = toNumericDelta(rawValue);
      if (numeric != null) {
        acc[key] = numeric;
      }
      return acc;
    }, {} as Record<string, number>);

    const ensureDelta = (key: string, currentValue: unknown, previousValue: unknown) => {
      if (enrichedDeltas[key] !== undefined) return;
      const current = toNumberValue(currentValue);
      const previous = toNumberValue(previousValue);
      if (current == null || previous == null) return;
      const delta = current - previous;
      if (delta !== 0) {
        enrichedDeltas[key] = delta;
      }
    };

    if (previousPoint) {
      ensureDelta("trophies", point.trophies, previousPoint.trophies);
      ensureDelta("ranked_trophies", point.rankedTrophies, previousPoint.rankedTrophies);
      ensureDelta("donations", point.donations, previousPoint.donations);
      ensureDelta("donations_rcv", point.donationsReceived, previousPoint.donationsReceived);
      ensureDelta("war_stars", point.warStars, previousPoint.warStars);
      ensureDelta("attack_wins", point.attackWins, previousPoint.attackWins);
      ensureDelta("defense_wins", point.defenseWins, previousPoint.defenseWins);
      ensureDelta("capital_contrib", point.capitalContributions, previousPoint.capitalContributions);
      ensureDelta("builder_trophies", point.builderTrophies, previousPoint.builderTrophies);
      ensureDelta("builder_battle_wins", point.builderBattleWins, previousPoint.builderBattleWins);
      ensureDelta("exp_level", point.expLevel, previousPoint.expLevel);
      ensureDelta("rush_percent", point.rushPercent, previousPoint.rushPercent);
    }

    const heroLevelsRecord =
      point?.heroLevels && typeof point.heroLevels === "object"
        ? (point.heroLevels as Record<string, unknown>)
        : null;
    const prevHeroLevels =
      previousPoint?.heroLevels && typeof previousPoint.heroLevels === "object"
        ? (previousPoint.heroLevels as Record<string, unknown>)
        : null;
    if (heroLevelsRecord && prevHeroLevels) {
      Object.keys(HERO_DISPLAY_NAMES).forEach((heroKey) => {
        const current = toNumberValue(heroLevelsRecord[heroKey]);
        const previous = toNumberValue(prevHeroLevels[heroKey]);
        if (current == null || previous == null) return;
        const delta = current - previous;
        if (delta !== 0 && enrichedDeltas[`hero_${heroKey}`] === undefined) {
          enrichedDeltas[`hero_${heroKey}`] = delta;
        }
      });
    }

    const petLevelsRecord =
      point?.petLevels && typeof point.petLevels === "object"
        ? (point.petLevels as Record<string, unknown>)
        : null;
    const prevPetLevels =
      previousPoint?.petLevels && typeof previousPoint.petLevels === "object"
        ? (previousPoint.petLevels as Record<string, unknown>)
        : null;
    if (petLevelsRecord && prevPetLevels) {
      Object.keys(petLevelsRecord).forEach((petKey) => {
        const current = toNumberValue(petLevelsRecord[petKey]);
        const previous = toNumberValue(prevPetLevels[petKey]);
        if (current == null || previous == null) return;
        const delta = current - previous;
        const deltaKey = `pet_${petKey}`;
        if (delta !== 0 && enrichedDeltas[deltaKey] === undefined) {
          enrichedDeltas[deltaKey] = delta;
        }
      });
    }

    const equipmentLevelsRecord =
      point?.equipmentLevels && typeof point.equipmentLevels === "object"
        ? (point.equipmentLevels as Record<string, unknown>)
        : null;
    const prevEquipmentLevels =
      previousPoint?.equipmentLevels && typeof previousPoint.equipmentLevels === "object"
        ? (previousPoint.equipmentLevels as Record<string, unknown>)
        : null;
    if (equipmentLevelsRecord && prevEquipmentLevels) {
      Object.keys(equipmentLevelsRecord).forEach((equipmentKey) => {
        const current = toNumberValue(equipmentLevelsRecord[equipmentKey]);
        const previous = toNumberValue(prevEquipmentLevels[equipmentKey]);
        if (current == null || previous == null) return;
        const delta = current - previous;
        const deltaKey = `equipment_${equipmentKey}`;
        if (delta !== 0 && enrichedDeltas[deltaKey] === undefined) {
          enrichedDeltas[deltaKey] = delta;
        }
      });
    }

    if (enrichedDeltas.th !== undefined && enrichedDeltas.th <= 0) {
      delete enrichedDeltas.th;
    }

    Object.keys(enrichedDeltas).forEach((key) => {
      if (
        (key.startsWith("hero_") || key.startsWith("pet_") || key.startsWith("equipment_")) &&
        enrichedDeltas[key] <= 0
      ) {
        delete enrichedDeltas[key];
      }
    });

    const hasHeroUpgrade = Object.keys(enrichedDeltas).some((key) => key.startsWith("hero_"));
    const hasPetUpgrade = Object.keys(enrichedDeltas).some((key) => key.startsWith("pet_"));
    const hasEquipmentUpgrade = Object.keys(enrichedDeltas).some((key) => key.startsWith("equipment_"));

    const normalizedEvents = rawEvents.filter((event) => {
      switch (event) {
        case "th_level_up":
          return enrichedDeltas.th !== undefined;
        case "hero_level_up":
          return hasHeroUpgrade;
        case "pet_level_up":
          return hasPetUpgrade;
        case "equipment_upgrade":
          return hasEquipmentUpgrade;
        default:
          return true;
      }
    });

    const hasDeltas = Object.keys(enrichedDeltas).length > 0;

    if (!normalizedEvents.length && notability <= 0 && !hasDeltas) {
      return;
    }

    const primaryEvent = normalizedEvents.find((event) => EVENT_META[event]) ?? (notability > 0 ? "highlight" : null);
    if (!primaryEvent) return;

    const meta = EVENT_META[primaryEvent] ?? DEFAULT_EVENT_META;
    const otherEventLabels = normalizedEvents
      .filter((event) => event !== primaryEvent && EVENT_META[event])
      .map((event) => EVENT_META[event].title);

    const descriptionParts: string[] = [];
    const usedDeltaKeys = new Set<string>();

    const appendDescription = (key: string | null, text: string | null | undefined) => {
      if (!text) return;
      descriptionParts.push(text);
      if (key) usedDeltaKeys.add(key);
    };

    const standardDeltaOrder = [
      "trophies",
      "ranked_trophies",
      "donations",
      "donations_rcv",
      "war_stars",
      "capital_contrib",
      "legend_attacks",
      "attack_wins",
      "defense_wins",
      "builder_trophies",
      "builder_battle_wins",
      "exp_level",
      "rush_percent",
    ];
    const standardDeltaSet = new Set(standardDeltaOrder);
    const processedStandardKeys = new Set<string>();

    const formatStandardDelta = (key: string, delta: number): string | null => {
      switch (key) {
        case "trophies": {
          const now = point.trophies != null ? formatNumber(point.trophies) : null;
          return now ? `Trophies ${formatSignedNumber(delta)} (now ${now})` : `Trophies ${formatSignedNumber(delta)}`;
        }
        case "ranked_trophies": {
          const now = point.rankedTrophies != null ? formatNumber(point.rankedTrophies) : null;
          return now
            ? `Ranked trophies ${formatSignedNumber(delta)} (now ${now})`
            : `Ranked trophies ${formatSignedNumber(delta)}`;
        }
        case "donations":
          return point.donations != null
            ? `Donations given ${formatSignedNumber(delta)} (now ${formatNumber(point.donations)})`
            : `Donations given ${formatSignedNumber(delta)}`;
        case "donations_rcv":
          return point.donationsReceived != null
            ? `Donations received ${formatSignedNumber(delta)} (now ${formatNumber(point.donationsReceived)})`
            : `Donations received ${formatSignedNumber(delta)}`;
        case "war_stars":
          return point.warStars != null
            ? `War stars ${formatSignedNumber(delta)} (now ${formatNumber(point.warStars)})`
            : `War stars ${formatSignedNumber(delta)}`;
        case "attack_wins":
          return point.attackWins != null
            ? `War attack wins ${formatSignedNumber(delta)} (now ${formatNumber(point.attackWins)})`
            : `War attack wins ${formatSignedNumber(delta)}`;
        case "defense_wins":
          return point.defenseWins != null
            ? `War defense wins ${formatSignedNumber(delta)} (now ${formatNumber(point.defenseWins)})`
            : `War defense wins ${formatSignedNumber(delta)}`;
        case "capital_contrib":
          return point.capitalContributions != null
            ? `Capital gold ${formatSignedNumber(delta)} (now ${formatNumber(point.capitalContributions)})`
            : `Capital gold ${formatSignedNumber(delta)}`;
        case "legend_attacks": {
          const currentLegendAttacks = (point as any)?.legendAttacks;
          return currentLegendAttacks != null
            ? `Legend attacks ${formatSignedNumber(delta)} (now ${formatNumber(currentLegendAttacks)})`
            : `Legend attacks ${formatSignedNumber(delta)}`;
        }
        case "builder_trophies":
          return point.builderTrophies != null
            ? `Builder trophies ${formatSignedNumber(delta)} (now ${formatNumber(point.builderTrophies)})`
            : `Builder trophies ${formatSignedNumber(delta)}`;
        case "builder_battle_wins":
          return point.builderBattleWins != null
            ? `Builder battle wins ${formatSignedNumber(delta)} (now ${formatNumber(point.builderBattleWins)})`
            : `Builder battle wins ${formatSignedNumber(delta)}`;
        case "exp_level":
          return point.expLevel != null
            ? `Account level ${formatSignedNumber(delta)} (now ${formatNumber(point.expLevel)})`
            : `Account level ${formatSignedNumber(delta)}`;
        case "rush_percent": {
          const now = point.rushPercent != null ? formatPercent(point.rushPercent) : null;
          return now
            ? `Rush score ${formatSignedNumber(delta)} pts (now ${now})`
            : `Rush score ${formatSignedNumber(delta)} pts`;
        }
        default:
          return null;
      }
    };

    const trophiesDelta = enrichedDeltas.trophies;
    const rankedDelta = enrichedDeltas.ranked_trophies;
    const trophiesNowValue = toNumberValue(point.trophies);
    const rankedNowValue = toNumberValue(point.rankedTrophies);

    if (
      trophiesDelta !== undefined &&
      rankedDelta !== undefined &&
      trophiesDelta === rankedDelta &&
      trophiesNowValue != null &&
      rankedNowValue != null &&
      trophiesNowValue === rankedNowValue
    ) {
      const summary = formatStandardDelta("trophies", trophiesDelta);
      if (summary) {
        appendDescription("trophies", summary);
        usedDeltaKeys.add("ranked_trophies");
        processedStandardKeys.add("trophies");
        processedStandardKeys.add("ranked_trophies");
      }
    }

    standardDeltaOrder.forEach((key) => {
      if (processedStandardKeys.has(key)) return;
      const delta = enrichedDeltas[key];
      if (delta === undefined) return;
      const summary = formatStandardDelta(key, delta);
      if (summary) {
        appendDescription(key, summary);
        processedStandardKeys.add(key);
      }
    });

    Object.entries(enrichedDeltas)
      .filter(([key]) => key.startsWith("hero_"))
      .forEach(([heroKey, delta]) => {
        const shortKey = heroKey.replace("hero_", "");
        const heroName = HERO_DISPLAY_NAMES[shortKey] ?? toTitleCase(shortKey);
        const absolute = Math.abs(delta);
        const levelLabel = absolute === 1 ? "level" : "levels";
        const targetLevelValue =
          heroLevelsRecord && shortKey in heroLevelsRecord ? toNumberValue(heroLevelsRecord[shortKey]) : null;
        const nowText = targetLevelValue != null ? ` (now ${formatNumber(targetLevelValue)})` : "";
        const changeVerb = delta > 0 ? "leveled up" : "dropped";
        appendDescription(heroKey, `${heroName} ${changeVerb} ${formatNumber(absolute)} ${levelLabel}${nowText}`);
      });

    Object.entries(enrichedDeltas)
      .filter(([key]) => key.startsWith("pet_"))
      .forEach(([petKey, delta]) => {
        const shortKey = petKey.replace("pet_", "");
        const petName = toTitleCase(shortKey);
        const absolute = Math.abs(delta);
        const levelLabel = absolute === 1 ? "level" : "levels";
        const currentLevel =
          petLevelsRecord && shortKey in petLevelsRecord ? toNumberValue(petLevelsRecord[shortKey]) : null;
        const nowText = currentLevel != null ? ` (now ${formatNumber(currentLevel)})` : "";
        const changeVerb = delta > 0 ? "leveled up" : "dropped";
        appendDescription(petKey, `${petName} ${changeVerb} ${formatNumber(absolute)} ${levelLabel}${nowText}`);
      });

    Object.entries(enrichedDeltas)
      .filter(([key]) => key.startsWith("equipment_"))
      .forEach(([equipmentKey, delta]) => {
        const shortKey = equipmentKey.replace("equipment_", "");
        const equipmentName = toTitleCase(shortKey);
        const absolute = Math.abs(delta);
        const levelLabel = absolute === 1 ? "level" : "levels";
        const currentLevel =
          equipmentLevelsRecord && shortKey in equipmentLevelsRecord
            ? toNumberValue(equipmentLevelsRecord[shortKey])
            : null;
        const nowText = currentLevel != null ? ` (now ${formatNumber(currentLevel)})` : "";
        const changeVerb = delta > 0 ? "upgraded" : "downgraded";
        appendDescription(
          equipmentKey,
          `${equipmentName} ${changeVerb} ${formatNumber(absolute)} ${levelLabel}${nowText}`,
        );
      });

    if (enrichedDeltas.th !== undefined) {
      const changeMagnitude = Math.abs(enrichedDeltas.th);
      const levelLabel = changeMagnitude === 1 ? "level" : "levels";
      const changeDirection = enrichedDeltas.th > 0 ? "upgraded" : "downgraded";
      appendDescription("th", `Town Hall ${changeDirection} ${formatNumber(changeMagnitude)} ${levelLabel}`);
    }

    Object.entries(enrichedDeltas).forEach(([key, delta]) => {
      if (usedDeltaKeys.has(key)) return;
      if (standardDeltaSet.has(key)) return;
      if (key.startsWith("hero_") || key.startsWith("pet_") || key.startsWith("equipment_")) return;
      appendDescription(key, `${toTitleCase(key)} ${formatSignedNumber(delta)}`);
    });

    if (!descriptionParts.length) {
      const fallbackDescriptions = buildEventFallbackDescriptions(
        point,
        primaryEvent,
        otherEventLabels,
        enrichedDeltas,
      );
      if (fallbackDescriptions.length) {
        descriptionParts.push(...fallbackDescriptions);
      }
    }

    if (!descriptionParts.length) {
      const statsContext = buildStatsContext(point, usedDeltaKeys);
      if (statsContext) {
        descriptionParts.push(statsContext);
      }
    }

    if (!descriptionParts.length) {
      return;
    }

    let specificTitle = meta.title;
    if (enrichedDeltas.trophies !== undefined || enrichedDeltas.ranked_trophies !== undefined) {
      const deltaValue = enrichedDeltas.trophies ?? enrichedDeltas.ranked_trophies ?? 0;
      specificTitle = `Trophy ${deltaValue >= 0 ? "Gain" : "Loss"}`;
    } else if (enrichedDeltas.donations !== undefined || enrichedDeltas.donations_rcv !== undefined) {
      specificTitle = "Donation Activity";
    } else if (enrichedDeltas.war_stars !== undefined) {
      specificTitle = "War Performance";
    } else if (enrichedDeltas.capital_contrib !== undefined) {
      specificTitle = "Capital Contribution";
    } else if (Object.keys(enrichedDeltas).some((key) => key.startsWith("hero_"))) {
      specificTitle = "Hero Upgrade";
    } else if (enrichedDeltas.th !== undefined) {
      specificTitle = "Town Hall Upgrade";
    }

    items.push({
      id: `canonical-${point.snapshotDate}-${index}`,
      date: point.snapshotDate,
      title: specificTitle,
      description: descriptionParts.join(" • "),
      tone: meta.tone,
      icon: meta.icon,
    });
  });

  if (includeLeadership && profile?.history) {
    profile.history.movements.forEach((movement, index) => {
      if (!movement?.date) return;
      const title =
        movement.type === 'joined'
          ? 'Joined the clan'
          : movement.type === 'departed'
            ? 'Departed the clan'
            : 'Returned to the clan';
      const descriptionParts: string[] = [];
      if (movement.reason) descriptionParts.push(movement.reason);
      if (movement.tenureAtDeparture != null) {
        descriptionParts.push(`${movement.tenureAtDeparture} day tenure credited`);
      }
      if (movement.notes) descriptionParts.push(movement.notes);
      items.push({
        id: `movement-${index}-${movement.date}`,
        date: movement.date,
        title,
        description: descriptionParts.join(' • ') || undefined,
        tone:
          movement.type === 'departed'
            ? 'warning'
            : movement.type === 'returned'
              ? 'positive'
              : 'default',
        icon:
          movement.type === 'joined'
            ? 'join'
            : movement.type === 'departed'
              ? 'depart'
              : 'return',
      });
    });

    profile.leadership.tenureActions.forEach((action) => {
      if (!action.createdAt) return;
      const isGrant = action.action === 'granted';
      items.push({
        id: `tenure-${action.id}`,
        date: action.createdAt,
        title: isGrant ? 'Tenure granted' : 'Tenure revoked',
        description: action.reason || undefined,
        tone: isGrant ? 'positive' : 'warning',
        icon: 'tenure',
      });
    });

    profile.leadership.warnings.forEach((warning) => {
      if (!warning.createdAt) return;
      items.push({
        id: `warning-${warning.id}`,
        date: warning.createdAt,
        title: warning.isActive ? 'Warning issued' : 'Warning recorded',
        description: warning.warningNote || undefined,
        tone: 'warning',
        icon: 'warning',
      });
    });

    profile.leadership.notes.forEach((note) => {
      if (!note.createdAt) return;
      items.push({
        id: `note-${note.id}`,
        date: note.createdAt,
        title: 'Leadership note',
        description: note.note,
        tone: 'default',
        icon: 'note',
      });
    });
  }

  profile?.joinerEvents.forEach((event) => {
    if (!event.detectedAt) return;
    items.push({
      id: `joiner-${event.id}`,
      date: event.detectedAt,
      title: event.status === 'reviewed' ? 'Joiner reviewed' : 'New joiner detected',
      description:
        event.metadata?.source_snapshot_id
          ? `Snapshot ${event.metadata.source_snapshot_id}`
          : undefined,
      tone: event.status === 'reviewed' ? 'positive' : 'default',
      icon: 'joiner',
    });
  });

  const sortedItems = items.sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return bTime - aTime;
  });
  
  return sortedItems;
}

function deriveDonationSeries(profile: SupabasePlayerProfilePayload | null) {
  if (!profile?.timeline?.length) return [];
  return profile.timeline
    .filter((point) => point.snapshotDate)
    .map((point) => ({
      date: point.snapshotDate as string,
      donations: point.donations ?? null,
      donationsReceived: point.donationsReceived ?? null,
    }));
}

function deriveKudos(profile: SupabasePlayerProfilePayload | null) {
  if (!profile?.timeline?.length) {
    return "No seasonal activity captured yet — run a snapshot to generate kudos suggestions.";
  }
  const entries = profile.timeline.filter(
    (point) => point.donations != null || point.donationsReceived != null,
  );
  if (entries.length < 2) {
    return "Season just started — track donations for a few more pulls to surface kudos.";
  }
  const first = entries[0];
  const last = entries[entries.length - 1];
  const donationDelta =
    last.donations != null && first.donations != null ? last.donations - first.donations : 0;
  if (donationDelta > 0) {
    return `Delivered ${formatNumber(donationDelta)} troops across the latest tracking window — worthy of a quick shout-out.`;
  }
  return "No standout donation spikes this week — keep nudging for balance or review war participation instead.";
}

export default function PlayerProfileClient({ tag, initialProfile }: PlayerProfileClientProps) {
  const router = useRouter();
  const normalizedTag = useMemo(() => normalizeTag(tag), [tag]);
  const plainTag = normalizedTag.replace("#", "");

  const { permissions } = useLeadership();
  const canViewLeadership = permissions.canViewLeadershipFeatures;

  // Use shared dashboard store (SSOT - Single Source of Truth)
  const roster = useDashboardStore(useShallow((state) => state.roster));
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || cfg.homeClanTag);
  const loadRoster = useDashboardStore((state) => state.loadRoster);
  const clanName = useDashboardStore(selectors.clanName);
  const currentUserEmail = useDashboardStore((state) => state.currentUser?.email ?? null);

  // Find player in roster (SSOT for current state)
  const rosterMember = useMemo(() => {
    if (!roster?.members?.length || !normalizedTag) return null;
    return roster.members.find(
      (member) => normalizeTag(member.tag) === normalizedTag
    ) ?? null;
  }, [roster, normalizedTag]);

  // Load roster if not already loaded
  useEffect(() => {
    if (!roster && clanTag) {
      void loadRoster(clanTag);
    }
  }, [roster, clanTag, loadRoster]);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningText, setWarningText] = useState("");
  const [warningSaving, setWarningSaving] = useState(false);
  const [showEquipmentTierModal, setShowEquipmentTierModal] = useState(false);
  const [expandedChart, setExpandedChart] = useState<'dna' | 'stats' | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<Array<{ tag: string; name: string | null }>>([]);
  const [showAddAliasModal, setShowAddAliasModal] = useState(false);
  const [aliasTagInput, setAliasTagInput] = useState("");
  const [aliasSaving, setAliasSaving] = useState(false);
  
  // Collapsible sections - default to collapsed
  const [activityScoreExpanded, setActivityScoreExpanded] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  
  // Close actions menu on outside click
  useEffect(() => {
    if (!actionsMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionsMenuOpen]);

  // Use SWR for player profile fetching with caching
  // Include clanTag in the key so it refetches when clan changes
  const normalizedClanTag = normalizeTag(clanTag);
  const profileKey = normalizedTag 
    ? `/api/player/${encodeURIComponent(normalizedTag)}/profile${normalizedClanTag ? `?clanTag=${encodeURIComponent(normalizedClanTag)}` : ''}`
    : null;
  const { data: profile, error: swrError, isLoading, mutate: mutateProfile } = useSWR<SupabasePlayerProfilePayload>(
    profileKey,
    playerProfileFetcher,
    {
      ...playerProfileSWRConfig,
      fallbackData: initialProfile ?? undefined, // Use initial data if available
      onSuccess: (data) => {
        console.log('[PlayerProfile] SWR loaded profile:', {
          tag: data.summary?.tag,
          name: data.summary?.name,
        });
      },
      onError: (err) => {
        console.error('[PlayerProfile] SWR error:', err);
      },
    }
  );

  // Convert SWR error to string for ErrorDisplay
  const error = swrError ? (swrError instanceof Error ? swrError.message : String(swrError)) : null;
  const loading = isLoading;

  // loadProfile function for retry (uses SWR mutate)
  const loadProfile = useCallback(async () => {
    if (!normalizedTag) return;
    await mutateProfile(); // SWR mutate triggers revalidation
  }, [normalizedTag, mutateProfile]);

  // Load linked accounts
  useEffect(() => {
    if (!normalizedTag || !clanTag) return;
    
    const loadLinkedAccounts = async () => {
      try {
        const response = await fetch(`/api/player-aliases?clanTag=${encodeURIComponent(clanTag)}&playerTag=${encodeURIComponent(normalizedTag)}&includeNames=true`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setLinkedAccounts(result.data || []);
          }
        }
      } catch (err) {
        console.error('Failed to load linked accounts:', err);
      }
    };
    
    loadLinkedAccounts();
  }, [normalizedTag, clanTag]);

  // SWR handles all fetching - no manual fetch needed!
  // Invalid tag is handled by SWR (profileKey will be null)

  // Merge roster data (SSOT) with profile data
  // Roster data takes priority for current state, profile data provides timeline/history
  const profileSummary = profile?.summary ?? null;
  const mergedSummary = useMemo(() => {
    if (!profileSummary) return null;
    
    // If we have roster member data, use it as SSOT for current state
    if (rosterMember) {
      // Use roster member's activity (calculated from roster API)
      const rosterActivity = getMemberActivity(rosterMember);
      
      return {
        ...profileSummary,
        // Current state from roster (SSOT)
        name: rosterMember.name ?? profileSummary.name,
        tag: rosterMember.tag ?? profileSummary.tag,
        role: rosterMember.role ?? profileSummary.role,
        townHallLevel: rosterMember.townHallLevel ?? profileSummary.townHallLevel,
        trophies: rosterMember.trophies ?? profileSummary.trophies,
        rankedTrophies: rosterMember.rankedTrophies ?? profileSummary.rankedTrophies,
        donations: {
          given: rosterMember.donations ?? profileSummary.donations.given,
          received: rosterMember.donationsReceived ?? profileSummary.donations.received,
        },
        rankedLeague: {
          id: rosterMember.rankedLeagueId ?? profileSummary.rankedLeague.id,
          name: rosterMember.rankedLeagueName ?? profileSummary.rankedLeague.name,
        },
        lastWeekTrophies: rosterMember.lastWeekTrophies ?? profileSummary.lastWeekTrophies,
        seasonTotalTrophies: rosterMember.seasonTotalTrophies ?? profileSummary.seasonTotalTrophies,
        // Use roster activity as SSOT
        activity: rosterActivity,
        activityScore: rosterActivity.score ?? profileSummary.activityScore,
      };
    }
    
    // Fallback to profile summary if no roster data
    return profileSummary;
  }, [profileSummary, rosterMember]);

  const summary = mergedSummary;
  const history = profile?.history ?? null;
  const activeWarning = canViewLeadership
    ? profile?.leadership.warnings.find((warning) => warning.isActive) ?? null
    : null;
  const latestNote = canViewLeadership ? profile?.leadership.notes[0] ?? null : null;

  // Calculate Player DNA and Stats data (available for analysis tab and modal)
  const analysisData = useMemo(() => {
    let playerDNA = null;
    let playerArchetype: string | null = null;
    let clanAverageDNA = null;
    let dnaBreakdown = null;

    if (roster && rosterMember && roster.members.length > 0) {
      const clanAverages = {
        averageDonations: roster.members.reduce((sum, m) => sum + (m.donations ?? 0), 0) / roster.members.length,
        averageWarStars: roster.members.reduce((sum, m) => sum + (m.warStars ?? 0), 0) / roster.members.length,
        averageCapitalContributions: roster.members.reduce((sum, m) => sum + (m.clanCapitalContributions ?? 0), 0) / roster.members.length,
        totalMembers: roster.members.length
      };
      playerDNA = calculatePlayerDNA(rosterMember, clanAverages);
      playerArchetype = classifyPlayerArchetype(playerDNA, rosterMember);
      
      // Calculate clan average DNA for overlay
      const clanDNA = calculateClanDNA(roster.members);
      clanAverageDNA = clanDNA.averageDNA;
      
      // Calculate clan average tenure for context-aware descriptions
      const clanAverageTenure = roster.members.length > 0
        ? roster.members.reduce((sum, m) => sum + (m.tenure ?? 0), 0) / roster.members.length
        : undefined;
      
      // Generate breakdown explanations for tooltips
      dnaBreakdown = generateDNABreakdown(playerDNA, rosterMember, clanAverageTenure);
    }

    // Prepare stats for Stats Radar Chart
    const clanStatsAverages = profile?.clanStatsAverages ?? {
      trophies: 0,
      donations: 0,
      warStars: 0,
      capitalContributions: 0,
      townHallLevel: 0,
      vipScore: 0,
    };

    const playerStats = summary ? {
      trophies: summary.rankedTrophies ?? summary.trophies ?? 0,
      donations: summary.donations?.given ?? 0,
      warStars: summary.war?.stars ?? 0,
      capitalContributions: summary.capitalContributions ?? 0,
      townHallLevel: summary.townHallLevel ?? 0,
      vipScore: profile?.vip?.current?.score ?? 0,
    } : null;

    return {
      playerDNA,
      playerArchetype,
      clanAverageDNA,
      dnaBreakdown,
      playerStats,
      clanStatsAverages,
    };
  }, [roster, rosterMember, profile, summary]);

  const activityEvidence = summary?.activity ?? null;
  const activityScore = activityEvidence?.score ?? summary?.activityScore ?? null;
  const activityTooltip = useMemo(() => {
    if (!activityEvidence) return 'Activity score not yet calculated';
    const segments: string[] = [];
    segments.push(
      `Score ${activityEvidence.score} (${activityEvidence.level}) • confidence ${activityEvidence.confidence}`,
    );
    if (activityEvidence.breakdown) {
      const contributors = Object.entries(activityEvidence.breakdown)
        .filter(([, value]) => value > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([key, value]) => `${key}: ${value.toFixed(1)} pts`);
      if (contributors.length) {
        segments.push(`Top signals: ${contributors.join(', ')}`);
      }
    }
    if (activityEvidence.indicators?.length) {
      segments.push(`Indicators: ${activityEvidence.indicators.join('; ')}`);
    }
    if (activityEvidence.metrics?.lookbackDays) {
      segments.push(`Lookback window: ${activityEvidence.metrics.lookbackDays} day(s)`);
    }
    return segments.join(' • ');
  }, [activityEvidence]);

  const donationSeries = useMemo(() => deriveDonationSeries(profile ?? null), [profile]);
  const kudosSuggestion = useMemo(() => deriveKudos(profile ?? null), [profile]);
  const timelineItems = useMemo(
    () => buildTimeline(profile ?? null, canViewLeadership),
    [profile, canViewLeadership],
  );

  const timelineInsights = useMemo(() => {
    const insights: string[] = [];
    const timelineArray = Array.isArray(profile?.timeline)
      ? (profile.timeline as TimelinePoint[])
      : [];
    const points = timelineArray
      .filter((point): point is TimelinePoint & { snapshotDate: string } => Boolean(point?.snapshotDate))
      .sort((a, b) => {
        const aTime = new Date(a.snapshotDate as string).getTime();
        const bTime = new Date(b.snapshotDate as string).getTime();
        return bTime - aTime;
      });

    if (!points.length) {
      return insights;
    }

    const metrics = activityEvidence?.metrics ?? null;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const getDeltaValue = (point: TimelinePoint, candidates: string[]): number => {
      if (!point?.deltas || typeof point.deltas !== "object") return 0;
      const deltas = point.deltas as Record<string, unknown>;
      for (const key of candidates) {
        const value = deltas[key];
        if (typeof value === "number" && Number.isFinite(value)) {
          return value;
        }
      }
      return 0;
    };

    const recentPoints = points.filter((point) => {
      const date = new Date(point.snapshotDate as string);
      return !Number.isNaN(date.getTime()) && date >= sevenDaysAgo;
    });

    const sumPositive = (keys: string[]): number => {
      if (!recentPoints.length) return 0;
      return recentPoints.reduce((sum, point) => {
        const value = getDeltaValue(point, keys);
        return value > 0 ? sum + value : sum;
      }, 0);
    };

    const computeStreak = (keys: string[]): number => {
      let streak = 0;
      for (const point of points) {
        const date = new Date(point.snapshotDate as string);
        if (Number.isNaN(date.getTime()) || date < sevenDaysAgo) break;
        const delta = getDeltaValue(point, keys);
        if (delta > 0) {
          streak += 1;
        } else {
          break;
        }
      }
      return streak;
    };

    // Donation streak
    let donationStreak = 0;
    for (const point of points) {
      const date = new Date(point.snapshotDate as string);
      if (Number.isNaN(date.getTime()) || date < sevenDaysAgo) break;
      const donationDelta = getDeltaValue(point, ["donations", "donation_delta"]);
      if (donationDelta > 0) {
        donationStreak += 1;
      } else {
        break;
      }
    }
    if (donationStreak >= 3) {
      insights.push(`Donation streak: ${donationStreak} day${donationStreak > 1 ? "s" : ""} running`);
    }

    // Trophy swings (latest 3 pulls)
    const recentTrophies = points
      .slice(0, 3)
      .map((p) => (typeof p.trophies === "number" ? p.trophies : null))
      .filter((t): t is number => t !== null);
    if (recentTrophies.length >= 2) {
      const currentTrophies = recentTrophies[0];
      const previousTrophies = recentTrophies[recentTrophies.length - 1];
      const trophyGain = currentTrophies - previousTrophies;
      if (trophyGain > 100) {
        insights.push(`Trophy surge: +${formatNumber(trophyGain)} trophies this week`);
      } else if (trophyGain < -100) {
        insights.push(`Trophy drop: ${formatNumber(trophyGain)} trophies this week`);
      }
    }

    // War activity
    const warStarsTotal = metrics?.warStarsDelta ?? sumPositive(["war_stars"]);
    const attackWinsTotal = metrics?.attackWinsDelta ?? sumPositive(["attack_wins"]);
    const defenseWinsTotal = metrics?.defenseWinsDelta ?? sumPositive(["defense_wins"]);
    const warStreak = computeStreak(["war_stars", "attack_wins"]);
    if (warStarsTotal > 0 || attackWinsTotal > 0 || defenseWinsTotal > 0) {
      const parts: string[] = [];
      if (warStarsTotal > 0) {
        parts.push(`+${formatNumber(warStarsTotal)}⭐`);
      }
      if (attackWinsTotal > 0) {
        parts.push(`+${formatNumber(attackWinsTotal)} attack win${attackWinsTotal === 1 ? "" : "s"}`);
      }
      if (defenseWinsTotal > 0) {
        parts.push(`+${formatNumber(defenseWinsTotal)} defense hold${defenseWinsTotal === 1 ? "" : "s"}`);
      }
      const streakSuffix = warStreak >= 2 ? ` • ${warStreak}-day streak` : "";
      insights.push(`War gains: ${parts.join(" • ")}${streakSuffix}`);
    }

    // Capital contributions
    const capitalTotal =
      metrics?.capitalContributionDelta ?? sumPositive(["capital_contrib", "capital_delta"]);
    if (capitalTotal > 0) {
      insights.push(`Capital invested: ${formatNumber(capitalTotal)} gold this week`);
    }

    // Builder activity
    const builderWinsTotal =
      metrics?.builderWinsDelta ?? sumPositive(["builder_battle_wins", "versus_battle_wins"]);
    const builderHallDelta =
      metrics?.builderHallDelta ?? sumPositive(["builder_hall", "builder_hall_level", "bh"]);
    const builderTrophiesGain = sumPositive(["builder_trophies"]);
    if (builderWinsTotal >= 3 || builderHallDelta > 0 || builderTrophiesGain >= 30) {
      const parts: string[] = [];
      if (builderHallDelta > 0) {
        parts.push(`BH +${formatNumber(builderHallDelta)}`);
      }
      if (builderWinsTotal > 0) {
        parts.push(`+${formatNumber(builderWinsTotal)} builder wins`);
      }
      if (builderTrophiesGain >= 30) {
        parts.push(`+${formatNumber(builderTrophiesGain)} builder trophies`);
      }
      insights.push(`Builder push: ${parts.join(" • ")} over the past week`);
    }

    // Legend league check
    const legendActivity = recentPoints.some((point) => {
      const events = point.events ?? [];
      return Array.isArray(events) && events.includes("legend_activity");
    });
    if (legendActivity) {
      insights.push("Legend League battles logged this week");
    }

    // Active day count
    const activeDays = recentPoints.length;
    if (activeDays >= 6) {
      insights.push(`Highly active: ${activeDays} tracked days this week`);
    } else if (activeDays >= 4) {
      insights.push(`Regularly active: ${activeDays} tracked days this week`);
    }

    return insights;
  }, [profile?.timeline, activityEvidence]);

  const milestoneIcon = (kind: MilestoneKind) => {
    switch (kind) {
      case "hero":
        return <Sparkles className="h-4 w-4 text-amber-300" />;
      case "donation":
        return <Coins className="h-4 w-4 text-emerald-300" />;
      case "capital":
        return <Landmark className="h-4 w-4 text-sky-300" />;
      case "war":
        return <Medal className="h-4 w-4 text-rose-300" />;
      case "legend":
        return <Flame className="h-4 w-4 text-orange-300" />;
      case "builder":
        return <Hammer className="h-4 w-4 text-purple-300" />;
      default:
        return <Award className="h-4 w-4 text-slate-200" />;
    }
  };

  const milestoneHighlights = useMemo(() => {
    const timelineArray = Array.isArray(profile?.timeline)
      ? (profile.timeline as TimelinePoint[])
      : [];
    const chronological = timelineArray
      .filter((point): point is TimelinePoint & { snapshotDate: string } => Boolean(point?.snapshotDate))
      .sort(
        (a, b) =>
          new Date(a.snapshotDate as string).getTime() -
          new Date(b.snapshotDate as string).getTime(),
      );

    if (!chronological.length) return [] as MilestoneHighlight[];

    const donationThresholds = [20000, 10000, 5000, 2500, 1000, 500];
    const capitalThresholds = [1_000_000, 500_000, 250_000, 100_000];
    const highlights: MilestoneHighlight[] = [];

    const toNumeric = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const getDeltas = (point: TimelinePoint): Record<string, number> => {
      if (!point?.deltas || typeof point.deltas !== "object") return {};
      const output: Record<string, number> = {};
      Object.entries(point.deltas as Record<string, unknown>).forEach(([key, raw]) => {
        const numeric = toNumeric(raw);
        if (numeric != null) output[key] = numeric;
      });
      return output;
    };

    chronological.forEach((point, index) => {
      const prev = index > 0 ? chronological[index - 1] : null;
      const deltas = getDeltas(point);
      const events = Array.isArray(point.events) ? point.events : [];
      const dateIso = point.snapshotDate;
      const dateLabel = formatDate(dateIso);

      const addHighlight = (
        kind: MilestoneKind,
        title: string,
        detail: string,
        suffix: string,
      ) => {
        highlights.push({
          id: `${dateIso}-${kind}-${suffix}`,
          kind,
          title,
          detail,
          dateIso,
          dateDisplay: dateLabel,
        });
      };

      const pointTownHall =
        typeof (point as any)?.townHallLevel === "number"
          ? (point as any).townHallLevel
          : summary?.townHallLevel ?? null;
      const heroCaps =
        pointTownHall != null ? HERO_MAX_LEVELS[pointTownHall] ?? null : null;

      if (point.heroLevels && heroCaps) {
        (Object.keys(heroCaps) as Array<keyof typeof heroCaps>).forEach((heroKey) => {
          const cap = heroCaps?.[heroKey] ?? 0;
          if (!cap) return;
          const currentLevel =
            toNumeric((point.heroLevels as Record<string, unknown>)[heroKey]) ?? 0;
          const previousLevel =
            toNumeric(
              prev?.heroLevels
                ? (prev.heroLevels as Record<string, unknown>)[heroKey]
                : null,
            ) ?? 0;
          if (currentLevel >= cap && previousLevel < cap) {
            const heroName = HERO_DISPLAY_NAMES[heroKey] ?? heroKey.toUpperCase();
            addHighlight(
              "hero",
              `${heroName} maxed`,
              `Reached level ${formatNumber(currentLevel)} (cap ${formatNumber(cap)})`,
              `${heroKey}-${currentLevel}`,
            );
          }
        });
      }

      const donationsTotal = point.donations ?? null;
      const prevDonationsTotal = prev?.donations ?? null;
      if (donationsTotal != null) {
        for (const threshold of donationThresholds) {
          if (
            donationsTotal >= threshold &&
            (prevDonationsTotal == null || prevDonationsTotal < threshold)
          ) {
            addHighlight(
              "donation",
              "Donation milestone",
              `Crossed ${formatNumber(threshold)} troops donated`,
              `donation-${threshold}`,
            );
            break;
          }
        }
      }

      const capitalTotal = point.capitalContributions ?? null;
      const prevCapitalTotal = prev?.capitalContributions ?? null;
      if (capitalTotal != null) {
        for (const threshold of capitalThresholds) {
          if (
            capitalTotal >= threshold &&
            (prevCapitalTotal == null || prevCapitalTotal < threshold)
          ) {
            addHighlight(
              "capital",
              "Capital supporter",
              `Passed ${formatNumber(threshold)} capital gold contributed`,
              `capital-${threshold}`,
            );
            break;
          }
        }
      }

      const currentLeagueName = point.rankedLeagueName ?? point.leagueName ?? null;
      const previousLeagueName = prev?.rankedLeagueName ?? prev?.leagueName ?? null;
      if (currentLeagueName && previousLeagueName) {
        const promotionDelta = compareRankedLeagues(currentLeagueName, previousLeagueName);
        if (promotionDelta > 0) {
          const fromLabel = previousLeagueName ?? "Unranked";
          addHighlight(
            "league",
            "League promotion",
            `Promoted from ${fromLabel} to ${currentLeagueName}`,
            `league-${dateIso}-${currentLeagueName}`,
          );
        }
      }

      // War milestone: Only create when delta first occurs (not based on cumulative event)
      const warStarsDelta = deltas.war_stars ?? 0;
      if (warStarsDelta >= 6) {
        addHighlight(
          "war",
          "War standout",
          `Recorded ${formatNumber(warStarsDelta)} war stars`,
          `war-${dateIso}-${warStarsDelta}`,
        );
      }

      // Legend activity: Only create when it's NEW (present in current but not in previous)
      const prevEvents = Array.isArray(prev?.events) ? prev.events : [];
      const hasLegendActivity = events.includes("legend_activity");
      const hadLegendActivity = prevEvents.includes("legend_activity");
      if (hasLegendActivity && !hadLegendActivity) {
        addHighlight(
          "legend",
          "Legend League run",
          "Legend League battles recorded",
          `legend-${dateIso}`,
        );
      }

      const builderWinsDelta = deltas.builder_battle_wins ?? 0;
      const builderTrophiesDelta = deltas.builder_trophies ?? 0;
      if (builderWinsDelta >= 5 || builderTrophiesDelta >= 30) {
        addHighlight(
          "builder",
          "Builder push",
          builderWinsDelta >= 5
            ? `Won ${formatNumber(builderWinsDelta)} builder battles`
            : `Builder trophies up ${formatSignedNumber(builderTrophiesDelta)}`,
          `builder-${builderWinsDelta}-${builderTrophiesDelta}`,
        );
      }
    });

    const uniqueMap = new Map<string, MilestoneHighlight>();
    for (const entry of highlights) {
      const key = `${entry.kind}:${entry.detail}`;
      uniqueMap.set(key, entry);
    }
    const unique = Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime(),
    );
    return unique.slice(0, 4);
  }, [profile?.timeline, summary?.townHallLevel]);

  const activityBreakdownRows = useMemo(() => {
    if (!activityEvidence) return [];
    const breakdown = activityEvidence.breakdown ?? {} as any;
    const metrics = activityEvidence.metrics ?? {} as any;

    const rows: Array<{ key: string; label: string; score: number; detail: string }> = [];
    const pushRow = (key: string, label: string, scoreValue?: number, detail?: string) => {
      const score = typeof scoreValue === "number" ? scoreValue : 0;
      if (score <= 0 && (!detail || detail.trim() === "")) return;
      rows.push({
        key,
        label,
        score: Math.round(score),
        detail: detail ?? "",
      });
    };

    const warParts: string[] = [];
    if (metrics.warStarsDelta) {
      warParts.push(`+${formatNumber(metrics.warStarsDelta)}⭐`);
    }
    if (metrics.attackWinsDelta) {
      warParts.push(`+${formatNumber(metrics.attackWinsDelta)} atk`);
    }
    if (metrics.defenseWinsDelta) {
      warParts.push(`+${formatNumber(metrics.defenseWinsDelta)} def`);
    }
    pushRow("war", "War", breakdown.war, warParts.join(" • "));

    const capitalDetail =
      metrics.capitalContributionDelta && metrics.capitalContributionDelta > 0
        ? `+${formatNumber(metrics.capitalContributionDelta)} capital`
        : "";
    pushRow("capital", "Capital", breakdown.capital, capitalDetail);

    const builderParts: string[] = [];
    if (metrics.builderWinsDelta) {
      builderParts.push(`+${formatNumber(metrics.builderWinsDelta)} wins`);
    }
    if (metrics.builderHallDelta) {
      builderParts.push(`BH +${formatNumber(metrics.builderHallDelta)}`);
    }
    pushRow("builder", "Builder", breakdown.builder, builderParts.join(" • "));

    const donationParts: string[] = [];
    if (metrics.donationDelta) {
      donationParts.push(`+${formatNumber(metrics.donationDelta)} given`);
    }
    if (metrics.donationReceivedDelta) {
      donationParts.push(`+${formatNumber(metrics.donationReceivedDelta)} received`);
    }
    pushRow("donations", "Donations", breakdown.donations, donationParts.join(" • "));

    return rows;
  }, [activityEvidence]);

  const heroCaps = useMemo(() => {
    if (!summary?.townHallLevel) return null;
    return HERO_MAX_LEVELS[summary.townHallLevel] ?? null;
  }, [summary?.townHallLevel]);

  // Normalize hero level keys from API format (barbarianking, archerqueen) to short keys (bk, aq)
  const heroLevels = useMemo(() => {
    if (!summary?.heroLevels || typeof summary.heroLevels !== "object") return {};
    
    const raw = summary.heroLevels as Record<string, unknown>;
    const normalized: Record<string, number> = {};
    
    // Map full hero names to short keys
    const heroKeyMap: Record<string, string> = {
      'barbarianking': 'bk',
      'archerqueen': 'aq',
      'grandwarden': 'gw',
      'royalchampion': 'rc',
      'minionprince': 'mp',
      'battlemachine': 'mp', // Battle Machine is also MP
      'battlecopter': 'mp', // Battle Copter is also MP
    };
    
    // Try both full names and short keys
    Object.entries(raw).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      const shortKey = heroKeyMap[lowerKey] || lowerKey;
      if (['bk', 'aq', 'gw', 'rc', 'mp'].includes(shortKey)) {
        const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : 0);
        if (Number.isFinite(numValue) && numValue > 0) {
          normalized[shortKey] = numValue;
        }
      }
    });
    
    return normalized;
  }, [summary?.heroLevels]);

  // Get clan hero averages from the API response
  const clanHeroAverages = profile?.clanHeroAverages || {};
  console.log('Clan hero averages from API:', clanHeroAverages);

  // Hero icon mapping
const HERO_ICON_MAP: Record<string, { src: string; alt: string }> = {
  BK: { src: '/assets/heroes/Barbarian_King.png', alt: 'Barbarian King' },
  AQ: { src: '/assets/heroes/Archer_Queen.png', alt: 'Archer Queen' },
  GW: { src: '/assets/heroes/Grand_Warden.png', alt: 'Grand Warden' },
  RC: { src: '/assets/heroes/Royal_Champion.png', alt: 'Royal Champion' },
  MP: { src: '/assets/heroes/Minion_Prince.png', alt: 'Minion Prince' },
};

const HERO_LABELS: Record<string, string> = {
  BK: 'Barbarian King',
  AQ: 'Archer Queen',
  GW: 'Grand Warden',
  RC: 'Royal Champion',
  MP: 'Minion Prince',
};

  const petEntries = useMemo(() => {
    if (!summary?.pets) return [] as Array<[string, number]>;
    return Object.entries(summary.pets).sort(
      (a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0),
    );
  }, [summary?.pets]);

  const equipmentEntries = useMemo(() => {
    if (!summary?.equipmentLevels) return [] as Array<[string, number]>;
    const merged = new Map<string, number>();
    Object.entries(summary.equipmentLevels).forEach(([rawName, rawLevel]) => {
      const displayName = EQUIPMENT_NAME_ALIASES[rawName] ?? rawName;
      const numericLevel = Number(rawLevel) || 0;
      const current = merged.get(displayName);
      if (current == null || numericLevel > current) {
        merged.set(displayName, numericLevel);
      }
    });
    return Array.from(merged.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
  }, [summary?.equipmentLevels]);

  const superTroopList = summary?.superTroopsActive ?? [];
  const achievementSummary = summary?.achievements ?? { count: null, score: null };

  const handleCopySummary = useCallback(() => {
    if (!summary) return;
    
    const sections: string[] = [];
    
    // ========================================
    // BASIC INFORMATION
    // ========================================
    sections.push("═══════════════════════════════════════");
    sections.push("PLAYER PROFILE SUMMARY");
    sections.push("═══════════════════════════════════════");
    sections.push("");
    sections.push(`Name: ${summary.name ?? "Unknown"}`);
    sections.push(`Tag: ${summary.tag}`);
    if (summary.clanName) sections.push(`Clan: ${summary.clanName}`);
    if (summary.clanTag) sections.push(`Clan Tag: ${summary.clanTag}`);
    if (summary.role) sections.push(`Role: ${summary.role.charAt(0).toUpperCase() + summary.role.slice(1)}`);
    if (summary.townHallLevel) sections.push(`Town Hall Level: ${summary.townHallLevel}`);
    if (summary.expLevel != null) sections.push(`Experience Level: ${summary.expLevel}`);
    sections.push("");
    
    // ========================================
    // COMPETITIVE PERFORMANCE
    // ========================================
    sections.push("───────────────────────────────────────");
    sections.push("COMPETITIVE PERFORMANCE");
    sections.push("───────────────────────────────────────");
    if (summary.trophies != null) sections.push(`Current Trophies: ${formatNumber(summary.trophies)}`);
    if (summary.rankedTrophies != null) sections.push(`Ranked Battle Trophies: ${formatNumber(summary.rankedTrophies)}`);
    if (summary.bestTrophies != null) sections.push(`All-Time Best Trophies: ${formatNumber(summary.bestTrophies)}`);
    if (summary.bestVersusTrophies != null) sections.push(`Best Builder Base Trophies: ${formatNumber(summary.bestVersusTrophies)}`);
    
    if (summary.rankedLeague?.name) {
      const rankedLeague = summary.rankedLeague;
      const trophies = 'trophies' in rankedLeague ? rankedLeague.trophies : null;
      sections.push(`Ranked League: ${rankedLeague.name}${trophies != null ? ` (${formatNumber(trophies)} trophies)` : ""}`);
    }
    if (summary.league?.name && (!summary.rankedLeague?.name || summary.league.name !== summary.rankedLeague.name)) {
      const league = summary.league;
      const trophies = 'trophies' in league ? league.trophies : null;
      sections.push(`Regular League: ${league.name}${trophies != null ? ` (${formatNumber(trophies)} trophies)` : ""}`);
    }
    
    if (summary.seasonTotalTrophies != null) {
      sections.push(`Season Running Total: ${formatNumber(summary.seasonTotalTrophies)} trophies`);
    }
    if (summary.lastWeekTrophies != null) {
      sections.push(`Last Week Final (Monday): ${formatNumber(summary.lastWeekTrophies)} trophies`);
    }
    sections.push("");
    
    // ========================================
    // HERO LEVELS & PROGRESSION
    // ========================================
    sections.push("───────────────────────────────────────");
    sections.push("HERO LEVELS & PROGRESSION");
    sections.push("───────────────────────────────────────");
    if (heroLevels && heroCaps) {
      const heroKeys = ['bk', 'aq', 'gw', 'rc', 'mp'] as const;
      heroKeys.forEach((key) => {
        const level = typeof heroLevels[key] === 'number' ? heroLevels[key] : null;
        const max = heroCaps[key] ?? null;
        if (level != null || max != null) {
          const heroName = HERO_LABELS[key.toUpperCase()] ?? key.toUpperCase();
          const levelStr = level != null ? formatNumber(level) : "—";
          const maxStr = max != null ? formatNumber(max) : "—";
          const progress = level != null && max != null && max > 0 
            ? ` (${formatPercent((level / max) * 100)})`
            : "";
          sections.push(`${heroName}: ${levelStr}/${maxStr}${progress}`);
        }
      });
    }
    sections.push("");
    
    // ========================================
    // PETS & EQUIPMENT
    // ========================================
    if (petEntries.length > 0 || equipmentEntries.length > 0) {
      sections.push("───────────────────────────────────────");
      sections.push("PETS & EQUIPMENT");
      sections.push("───────────────────────────────────────");
      
      if (petEntries.length > 0) {
        sections.push("Pets:");
        petEntries.forEach(([petName, level]) => {
          sections.push(`  • ${petName}: Level ${formatNumber(level)}`);
        });
      }
      
      if (equipmentEntries.length > 0) {
        sections.push("Equipment:");
        equipmentEntries.forEach(([equipName, level]) => {
          sections.push(`  • ${equipName}: Level ${formatNumber(level)}`);
        });
      }
      sections.push("");
    }
    
    // ========================================
    // WAR PERFORMANCE
    // ========================================
    sections.push("───────────────────────────────────────");
    sections.push("WAR PERFORMANCE");
    sections.push("───────────────────────────────────────");
    if (summary.war?.stars != null) sections.push(`War Stars Earned: ${formatNumber(summary.war.stars)}`);
    if (summary.war?.attackWins != null) sections.push(`Attack Wins: ${formatNumber(summary.war.attackWins)}`);
    if (summary.war?.defenseWins != null) sections.push(`Defense Wins: ${formatNumber(summary.war.defenseWins)}`);
    if (summary.war?.preference) {
      const pref = summary.war.preference === "in" ? "Opted In" : summary.war.preference === "out" ? "Opted Out" : "Unknown";
      sections.push(`War Preference: ${pref}`);
    }
    sections.push("");
    
    // ========================================
    // DONATIONS & SUPPORT
    // ========================================
    sections.push("───────────────────────────────────────");
    sections.push("DONATIONS & SUPPORT");
    sections.push("───────────────────────────────────────");
    if (summary.donations?.given != null) sections.push(`Troops Donated: ${formatNumber(summary.donations.given)}`);
    if (summary.donations?.received != null) sections.push(`Troops Received: ${formatNumber(summary.donations.received)}`);
    // Calculate balance from given/received if balance property doesn't exist
    if (summary.donations) {
      const given = summary.donations.given ?? 0;
      const received = summary.donations.received ?? 0;
      // Use type guard to check if balance exists in the union type
      const balance = ('balance' in summary.donations && summary.donations.balance != null)
        ? (summary.donations as { balance: number | null }).balance!
        : (given - received);
      const balanceLabel = balance > 0 ? "Net Receiver" : balance < 0 ? "Net Donor" : "Balanced";
      sections.push(`Donation Balance: ${formatSignedNumber(balance)} (${balanceLabel})`);
    }
    sections.push("");
    
    // ========================================
    // CAPITAL & BUILDER BASE
    // ========================================
    sections.push("───────────────────────────────────────");
    sections.push("CAPITAL & BUILDER BASE");
    sections.push("───────────────────────────────────────");
    if (summary.capitalContributions != null) {
      sections.push(`Capital Gold Contributed: ${formatNumber(summary.capitalContributions)}`);
    }
    if (summary.builderBase?.hallLevel != null) {
      sections.push(`Builder Hall Level: ${summary.builderBase.hallLevel}`);
    }
    if (summary.builderBase?.trophies != null) {
      sections.push(`Builder Base Trophies: ${formatNumber(summary.builderBase.trophies)}`);
    }
    if (summary.builderBase?.battleWins != null) {
      sections.push(`Builder Battle Wins: ${formatNumber(summary.builderBase.battleWins)}`);
    }
    if (summary.builderBase?.leagueName) {
      sections.push(`Builder League: ${summary.builderBase.leagueName}`);
    }
    if (summary.battleModeTrophies != null) {
      sections.push(`Battle Mode Trophies: ${formatNumber(summary.battleModeTrophies)}`);
    }
    sections.push("");
    
    // ========================================
    // ACTIVITY & ENGAGEMENT
    // ========================================
    sections.push("───────────────────────────────────────");
    sections.push("ACTIVITY & ENGAGEMENT");
    sections.push("───────────────────────────────────────");
    if (summary.activityScore != null) {
      sections.push(`Activity Score: ${summary.activityScore.toFixed(1)}/65`);
    }
    if (activityEvidence?.level) {
      sections.push(`Activity Level: ${activityEvidence.level}`);
    }
    if (activityEvidence?.confidence) {
      const confidenceLabel = activityEvidence.confidence.charAt(0).toUpperCase() + activityEvidence.confidence.slice(1);
      sections.push(`Activity Confidence: ${confidenceLabel}`);
    }
    
    if (activityBreakdownRows.length > 0) {
      sections.push("Activity Breakdown:");
      activityBreakdownRows.forEach((row) => {
        const detail = row.detail ? ` (${row.detail})` : "";
        sections.push(`  • ${row.label}: ${row.score} pts${detail}`);
      });
    }
    
    if (timelineInsights.length > 0) {
      sections.push("Recent Activity Insights:");
      timelineInsights.forEach((insight) => {
        sections.push(`  • ${insight}`);
      });
    }
    sections.push("");
    
    // ========================================
    // BASE QUALITY & PROGRESSION
    // ========================================
    sections.push("───────────────────────────────────────");
    sections.push("BASE QUALITY & PROGRESSION");
    sections.push("───────────────────────────────────────");
    if (summary.rushPercent != null) {
      const rushLabel = summary.rushPercent >= 70 ? "Very Rushed" : summary.rushPercent >= 40 ? "Moderately Rushed" : "Well Developed";
      sections.push(`Rush Score: ${formatPercent(summary.rushPercent)} (${rushLabel})`);
      sections.push(`  Note: Rush score measures hero shortfall vs Town Hall caps. Lower is better (0% = fully maxed).`);
    }
    sections.push("");
    
    // ========================================
    // ACHIEVEMENTS & MILESTONES
    // ========================================
    if (achievementSummary.count != null || milestoneHighlights.length > 0) {
      sections.push("───────────────────────────────────────");
      sections.push("ACHIEVEMENTS & MILESTONES");
      sections.push("───────────────────────────────────────");
      if (achievementSummary.count != null) {
        sections.push(`Achievements Unlocked: ${formatNumber(achievementSummary.count)}`);
      }
      if (achievementSummary.score != null) {
        sections.push(`Achievement Score: ${formatNumber(achievementSummary.score)}`);
      }
      if (milestoneHighlights.length > 0) {
        sections.push("Recent Milestones:");
        milestoneHighlights.forEach((milestone) => {
          sections.push(`  • ${milestone.dateDisplay}: ${milestone.title} - ${milestone.detail}`);
        });
      }
      sections.push("");
    }
    
    // ========================================
    // SUPER TROOPS & EXTRAS
    // ========================================
    if (superTroopList.length > 0) {
      sections.push("───────────────────────────────────────");
      sections.push("SUPER TROOPS ACTIVE");
      sections.push("───────────────────────────────────────");
      sections.push(superTroopList.join(", "));
      sections.push("");
    }
    
    // ========================================
    // VIP SCORE (if available)
    // ========================================
    if (profile?.vip?.current) {
      sections.push("───────────────────────────────────────");
      sections.push("VIP SCORE (Clan Value Assessment)");
      sections.push("───────────────────────────────────────");
      sections.push(`Overall VIP Score: ${profile.vip.current.score.toFixed(1)}/100`);
      sections.push(`Clan Rank: #${profile.vip.current.rank}`);
      sections.push(`Competitive Score: ${profile.vip.current.competitive_score.toFixed(1)}/100`);
      sections.push(`Support Score: ${profile.vip.current.support_score.toFixed(1)}/100`);
      sections.push(`Development Score: ${profile.vip.current.development_score.toFixed(1)}/100`);
      sections.push(`  Note: VIP measures comprehensive clan contribution across Competitive (50%), Support (30%), and Development (20%) dimensions.`);
      sections.push("");
    }
    
    // ========================================
    // TENURE & HISTORY
    // ========================================
    sections.push("───────────────────────────────────────");
    sections.push("TENURE & HISTORY");
    sections.push("───────────────────────────────────────");
    if (summary.tenureDays != null) {
      sections.push(`Tenure: ${formatNumber(summary.tenureDays)} day${summary.tenureDays === 1 ? "" : "s"}`);
      if (summary.tenureAsOf) sections.push(`Tenure as of: ${formatDate(summary.tenureAsOf)}`);
    }
    if (summary.lastSeen) sections.push(`Last Seen: ${formatDate(summary.lastSeen)}`);
    if (history?.currentStint?.startDate) {
      sections.push(`Current Stint Started: ${formatDate(history.currentStint.startDate)}`);
    }
    
    const fullSummary = sections.join("\n");
    
    navigator.clipboard
      .writeText(fullSummary)
      .then(() => showToast("Copied comprehensive player summary", "success"))
      .catch(() => showToast("Unable to copy summary — copy manually instead", "error"));
  }, [
    summary, 
    history, 
    heroLevels, 
    heroCaps, 
    petEntries, 
    equipmentEntries, 
    superTroopList, 
    achievementSummary, 
    milestoneHighlights, 
    activityEvidence, 
    activityBreakdownRows, 
    timelineInsights,
    profile?.vip
  ]);

  const handleOpenInClash = useCallback(() => {
    if (!plainTag) return;
    const href = `https://link.clashofclans.com/?playerTag=${encodeURIComponent(plainTag)}`;
    window.open(href, "_blank", "noopener");
  }, [plainTag]);

  const clanTagForActions = summary?.clanTag ?? clanTag ?? null;

  const handleSaveNote = async () => {
    if (!canViewLeadership || !clanTagForActions || !normalizedTag || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      const response = await fetch("/api/player-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clanTag: clanTagForActions,
          playerTag: normalizedTag,
          playerName: summary?.name ?? normalizedTag,
          note: noteText.trim(),
          createdBy: currentUserEmail ?? "Leadership Dashboard",
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to save note");
      }
      showToast("Leadership note added", "success");
      setShowNoteModal(false);
      setNoteText("");
      await loadProfile();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to save note. Please retry.";
      showToast(message, "error");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleSaveWarning = async () => {
    if (!canViewLeadership || !clanTagForActions || !normalizedTag || !warningText.trim()) return;
    setWarningSaving(true);
    try {
      const response = await fetch("/api/player-warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clanTag: clanTagForActions,
          playerTag: normalizedTag,
          playerName: summary?.name ?? normalizedTag,
          warningNote: warningText.trim(),
          createdBy: currentUserEmail ?? "Leadership Dashboard",
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to record warning");
      }
      showToast("Warning recorded", "success");
      setShowWarningModal(false);
      setWarningText("");
      await loadProfile();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to record warning. Please retry.";
      showToast(message, "error");
    } finally {
      setWarningSaving(false);
    }
  };

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleAddAlias = useCallback(async () => {
    if (!aliasTagInput.trim() || !clanTag || !normalizedTag) return;
    
    setAliasSaving(true);
    try {
      const inputTag = normalizeTag(aliasTagInput.trim());
      if (!inputTag) {
        showToast("Invalid player tag format", "error");
        return;
      }

      console.log('[Add Alias] Attempting to link:', { clanTag, tag1: normalizedTag, tag2: inputTag });
      
      const response = await fetch('/api/player-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag,
          playerTag1: normalizedTag,
          playerTag2: inputTag,
          createdBy: currentUserEmail || 'Unknown',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Add Alias] API error:', response.status, errorText);
        try {
          const errorJson = JSON.parse(errorText);
          showToast(errorJson.error || `Failed to link accounts (${response.status})`, "error");
        } catch {
          showToast(`Failed to link accounts: ${errorText}`, "error");
        }
        return;
      }

      const result = await response.json();
      console.log('[Add Alias] API response:', result);
      
      if (!result.success) {
        console.error('[Add Alias] API returned success=false:', result.error);
        showToast(result.error || 'Failed to link accounts', "error");
        return;
      }

      showToast("Alias linked successfully", "success");
      setAliasTagInput("");
      setShowAddAliasModal(false);
      
      // Reload linked accounts
      const refreshResponse = await fetch(`/api/player-aliases?clanTag=${encodeURIComponent(clanTag)}&playerTag=${encodeURIComponent(normalizedTag)}&includeNames=true`);
      if (refreshResponse.ok) {
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success) {
          setLinkedAccounts(refreshResult.data || []);
        }
      }
    } catch (err: any) {
      console.error('Failed to add alias:', err);
      showToast("Failed to add alias: " + (err.message || "Unknown error"), "error");
    } finally {
      setAliasSaving(false);
    }
  }, [aliasTagInput, clanTag, normalizedTag, currentUserEmail]);

  const handleRemoveAlias = useCallback(async (linkedTag: string) => {
    if (!clanTag || !normalizedTag) return;
    
    try {
      const response = await fetch(`/api/player-aliases?clanTag=${encodeURIComponent(clanTag)}&playerTag1=${encodeURIComponent(normalizedTag)}&playerTag2=${encodeURIComponent(linkedTag)}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (!result.success) {
        showToast(result.error || 'Failed to remove alias link', "error");
        return;
      }

      showToast("Alias link removed", "success");
      
      // Reload linked accounts
      const refreshResponse = await fetch(`/api/player-aliases?clanTag=${encodeURIComponent(clanTag)}&playerTag=${encodeURIComponent(normalizedTag)}&includeNames=true`);
      if (refreshResponse.ok) {
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success) {
          setLinkedAccounts(refreshResult.data || []);
        }
      }
    } catch (err: any) {
      console.error('Failed to remove alias:', err);
      showToast("Failed to remove alias: " + (err.message || "Unknown error"), "error");
    }
  }, [clanTag, normalizedTag]);


  const aliasList = history?.aliases ?? [];

  const renderLoading = () => (
    <DashboardLayout>
      <PlayerProfileSkeleton />
    </DashboardLayout>
  );

  const renderError = () => {
    const errorType = categorizeError({ message: error || '' });
    return (
      <ErrorDisplay
        message={error || 'Failed to load player profile'}
        type={errorType}
        title="Unable to Load Profile"
        onRetry={() => {
          mutateProfile(); // SWR mutate triggers revalidation
        }}
        onGoBack={handleGoBack}
        onGoHome={() => router.push('/')}
      />
    );
  };

  return (
    <DashboardLayout clanName={clanName && clanName.trim().length > 0 ? clanName : undefined}>
      <div className="min-h-screen bg-slate-950/95 pb-20">
        <div className="w-full px-3 sm:px-4 pb-16 pt-6 sm:pt-10">
          <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 text-sm text-slate-400">
            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-700/70 bg-slate-800/50 px-2 py-1 sm:px-3 sm:py-1 text-xs uppercase tracking-[0.24em] text-slate-300 transition hover:bg-slate-800 min-h-[36px] sm:min-h-0"
              title="Go back"
              aria-label="Go back"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <span className="text-slate-500 hidden sm:inline">/</span>
            <span className="text-slate-300 text-xs sm:text-sm">Player Profile</span>
          </div>

          {/* Compact Tab Navigation with Actions */}
          <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-1 sm:gap-2">
            {(["overview", "history", "evaluations", "metrics", "analysis", "comparison"] as TabKey[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold capitalize transition min-h-[36px] sm:min-h-0 ${
                  activeTab === tab
                    ? "border-indigo-400 bg-indigo-500/30 text-indigo-200 shadow-[0_12px_30px_-20px_rgba(99,102,241,0.9)]"
                    : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-slate-100"
                }`}
                title={tab === "analysis" ? "Player Analysis" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                aria-label={tab === "analysis" ? "Player Analysis" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              >
                {tab === "overview" && <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                {tab === "history" && <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                {tab === "evaluations" && <SquarePen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                {tab === "metrics" && <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                {tab === "analysis" && <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                {tab === "comparison" && <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                <span className="hidden sm:inline">{tab === "analysis" ? "Player Analysis" : tab}</span>
              </button>
            ))}
            
            {/* Actions Menu - Integrated into tab navigation */}
            <div className="relative ml-auto" ref={actionsMenuRef}>
              <button
                onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
                className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold transition min-h-[36px] sm:min-h-0 ${
                  actionsMenuOpen
                    ? "border-indigo-400 bg-indigo-500/30 text-indigo-200"
                    : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-slate-100"
                }`}
                title="Actions menu"
                aria-label="Actions menu"
              >
                <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Actions</span>
              </button>
              
              {actionsMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-700/80 bg-slate-900/98 backdrop-blur-md shadow-2xl z-[100] overflow-hidden">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleCopySummary();
                        setActionsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800/80 transition-colors min-h-[44px] sm:min-h-0"
                      title="Copy player summary"
                    >
                      <Clipboard className="h-4 w-4" />
                      <span>Copy Summary</span>
                    </button>
                    <button
                      onClick={() => {
                        handleOpenInClash();
                        setActionsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800/80 transition-colors min-h-[44px] sm:min-h-0"
                      title="Open player in Clash of Clans"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Open in Clash</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="relative mb-6 sm:mb-10 overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-900/80 to-slate-900 p-4 sm:p-8 shadow-[0_40px_120px_-50px_rgba(79,70,229,0.6)]">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.25),transparent_55%)]" />
            <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:gap-4">
                <div className="flex flex-col gap-2 sm:gap-3">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-4">
                        <h1
                          className="font-black text-2xl sm:text-3xl md:text-4xl text-white tracking-wider drop-shadow-2xl"
                          style={{ fontFamily: "'Clash Display', sans-serif", fontWeight: '700', letterSpacing: '0.05em' }}
                        >
                          {loading ? "Loading player..." : (summary?.name ?? "Unknown Player")}
                        </h1>
                        {(summary?.townHallLevel || summary?.rankedLeague?.name || summary?.league?.name) && (
                          <div className="flex items-center gap-3">
                            <div className="flex h-14 w-14 items-center justify-center">
                              {summary?.townHallLevel ? (
                                <TownHallBadge
                                  level={summary.townHallLevel}
                                  size="lg"
                                  levelBadgeClassName="absolute -bottom-1 -right-1 text-xs font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                                />
                              ) : (
                                <span className="text-slate-300">TH?</span>
                              )}
                            </div>
                            {(summary?.rankedLeague?.name || summary?.league?.name) && (
                              <div className="flex items-center">
                                <LeagueBadge
                                  league={summary?.rankedLeague?.name ?? summary?.league?.name ?? undefined}
                                  trophies={summary?.rankedTrophies ?? summary?.league?.trophies ?? undefined}
                                  size="lg"
                                  showText={false}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300/80">
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.32em] text-slate-200">
                          {normalizedTag || "No Tag"}
                        </span>
                        {summary?.role && (
                          <span>{getRoleBadgeVariant(summary.role).label}</span>
                        )}
                        {history?.status && <span>• {history.status.toUpperCase()}</span>}
                      </div>
                    </div>
                    {activityScore != null && (
                      <div className="mt-2 sm:mt-4 lg:mt-0">
                        {!activityScoreExpanded ? (
                          <button
                            onClick={() => setActivityScoreExpanded(true)}
                            className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 sm:px-3 sm:py-2 backdrop-blur-sm hover:bg-white/10 transition-colors text-xs sm:text-sm"
                            title="Click to expand activity score details"
                          >
                            <Activity className={`h-3 w-3 sm:h-4 sm:w-4 ${
                              activityScore >= 70 ? "text-emerald-400" :
                              activityScore >= 45 ? "text-sky-400" :
                              activityScore >= 28 ? "text-amber-400" :
                              "text-rose-400"
                            }`} />
                            <span className="font-semibold text-white">{activityScore}</span>
                            <span className="text-slate-300 text-[10px] sm:text-xs">{activityEvidence?.level ?? "—"}</span>
                            <ChevronDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-400 ml-auto" />
                          </button>
                        ) : (
                          <div
                            className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 sm:px-3 sm:py-2.5 backdrop-blur-sm max-w-sm"
                            data-tooltip={activityTooltip || undefined}
                          >
                            <button
                              onClick={() => setActivityScoreExpanded(false)}
                              className="w-full flex items-center justify-between mb-2"
                            >
                              <p className="text-[10px] sm:text-xs uppercase tracking-[0.32em] text-slate-300/80">
                                Activity Score
                              </p>
                              <ChevronUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-400" />
                            </button>
                            <div className="flex items-center justify-between gap-2 sm:gap-3">
                              <div>
                                <p className="text-xl sm:text-2xl md:text-3xl font-black text-white drop-shadow-sm">
                                  {activityScore}
                                  <span className="ml-1.5 sm:ml-2 text-xs sm:text-sm font-semibold text-slate-300">
                                    {activityEvidence?.level ?? "—"}
                                  </span>
                                </p>
                              </div>
                              <div
                                className={`flex h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 items-center justify-center rounded-full border ${
                                  activityScore >= 70
                                    ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-200"
                                    : activityScore >= 45
                                      ? "border-sky-400/80 bg-sky-500/20 text-sky-200"
                                      : activityScore >= 28
                                        ? "border-amber-400/80 bg-amber-500/20 text-amber-200"
                                        : "border-rose-400/80 bg-rose-500/20 text-rose-200"
                                }`}
                              >
                                <Activity className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
                              </div>
                            </div>
                            {activityEvidence?.confidence && (
                              <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-400">
                                Confidence: {activityEvidence.confidence}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {loading && renderLoading()}
          {!loading && error && renderError()}

          {!loading && !error && (
            <div className="space-y-8">
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
                  <div className="space-y-6">
                    <GlassCard
                      title="Profile Overview"
                      subtitle="Live data pulled from Supabase player backbone"
                      icon={<BarChart3 className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.9)]"
                    >
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="space-y-4">
                          <div className="cursor-help" title="The player's current competitive league based on their ranked trophy count. Higher leagues require more trophies and offer better rewards.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Competitive League
                            </p>
                            <div className="mt-3">
                              {summary?.rankedLeague?.name || summary?.league?.name ? (
                                <LeagueBadge
                                  league={summary?.rankedLeague?.name ?? summary?.league?.name ?? undefined}
                                  trophies={summary?.rankedTrophies ?? summary?.league?.trophies ?? undefined}
                                  size="md"
                                  showText={false}
                                />
                              ) : (
                                <span className="text-slate-400">Unranked</span>
                              )}
                            </div>
                          </div>
                          <div className="cursor-help" title="Current ranked trophy count. Ranked trophies are earned through ranked battles and determine league placement. These reset at the end of each season.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Ranked Trophies
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.rankedTrophies != null
                                ? formatNumber(summary.rankedTrophies)
                                : "—"}
                            </p>
                          </div>
                          <div className="cursor-help" title="All-time highest trophy count achieved by this player. This represents their peak competitive performance across all seasons.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Best Trophies
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.bestTrophies != null
                                ? formatNumber(summary.bestTrophies)
                                : "—"}
                            </p>
                          </div>
                          <div className="cursor-help" title="Total ranked trophies earned during the current season. This accumulates from the start of the season until now, resetting at season end.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Season Total
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.seasonTotalTrophies != null
                                ? formatNumber(summary.seasonTotalTrophies)
                                : "—"}
                            </p>
                            {summary?.lastWeekTrophies != null && (
                              <p className="text-xs text-slate-400 cursor-help" title="Ranked trophy count from the start of the current week (Monday). Used to measure weekly progress and activity.">
                                Last Monday {formatNumber(summary.lastWeekTrophies)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="cursor-help" title="Total troops donated to clan members during the current season. Higher donations indicate stronger clan support and activity. Season resets periodically.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Seasonal Donations
                            </p>
                            <p className="mt-2 text-lg font-semibold text-emerald-300">
                              {summary?.donations?.given != null
                                ? formatNumber(summary.donations.given)
                                : "—"}
                            </p>
                            <p className="text-xs text-slate-400 cursor-help" title="Total troops received from clan members. A higher received count indicates active requesting and clan engagement.">
                              {summary?.donations?.received != null
                                ? `${formatNumber(summary.donations.received)} received`
                                : "Donation intake not tracked"}
                            </p>
                          </div>
                          <div className="cursor-help" title="Total capital gold contributed to Clan Capital upgrades during Raid Weekends. Higher contributions show stronger participation in clan capital development.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Capital Gold
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.capitalContributions != null
                                ? formatNumber(summary.capitalContributions)
                                : "—"}
                            </p>
                          </div>
                          <div className="cursor-help" title="Rush percentage indicates how much of the base is rushed. 0% = fully maxed, 100% = completely rushed. Lower scores show better base optimization and progression planning.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Rush Score
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.rushPercent != null
                                ? formatPercent(summary.rushPercent)
                                : "—"}
                            </p>
                          </div>
                          <div className="cursor-help" title="Activity score measures player engagement over the last 7 days based on donations, attacks, and clan participation. Scores range from 0-100, with higher scores indicating more active players.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Activity Score
                            </p>
                            <p className="mt-2 text-lg font-semibold text-indigo-200">
                              {summary?.activityScore != null
                                ? summary.activityScore.toFixed(1)
                                : "Awaiting data"}
                            </p>
                            <p className="text-xs text-slate-400 cursor-help" title="Last time this player was detected as active in the game. Based on data updates from the Clash API.">
                              {summary?.lastSeen
                                ? `Last seen ${formatRelative(summary.lastSeen) ?? ""}`
                                : "Last seen not captured"}
                            </p>
                          </div>
                          {profile?.vip?.current && (
                            <div className="cursor-help" title="VIP Score is a composite metric (0-100) that evaluates player value across three dimensions: Competitive (trophy performance, war stars), Support (donations, activity), and Development (base progression, hero levels). Higher scores indicate more valuable clan members.">
                              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                                VIP Score
                              </p>
                              <p className={`mt-2 text-lg font-semibold ${
                                profile.vip.current.score >= 80 ? 'text-green-400' :
                                profile.vip.current.score >= 50 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {profile.vip.current.score.toFixed(1)}
                              </p>
                              <p className="text-xs text-slate-400 cursor-help" title="Rank position within the clan based on VIP score. Breakdown shows: Competitive (trophy/war performance), Support (donations/activity), Development (base/hero progression).">
                                Rank #{profile.vip.current.rank} • Competitive: {profile.vip.current.competitive_score.toFixed(1)} • Support: {profile.vip.current.support_score.toFixed(1)} • Development: {profile.vip.current.development_score.toFixed(1)}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-4">
                          <div className="cursor-help" title="Builder Hall level in the Builder Base (Night Village). Maximum level is BH 10. Higher levels unlock more buildings and defenses, improving base strength in Versus Battles.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Builder Hall Level
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.builderBase?.hallLevel != null
                                ? `BH ${formatNumber(summary.builderBase.hallLevel)}`
                                : "—"}
                            </p>
                          </div>
                          <div className="cursor-help" title="Current trophy count in Builder Base Versus Battles. Trophies determine matchmaking and league placement. Higher trophies indicate stronger Builder Base performance.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Versus Trophies
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.builderBase?.trophies != null
                                ? formatNumber(summary.builderBase.trophies)
                                : "—"}
                            </p>
                          </div>
                          <div className="cursor-help" title="Total wins in Builder Base Versus Battles. Each battle pits your base against another player's base in simultaneous attacks. Higher win counts show more Builder Base activity.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Versus Battle Wins
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.builderBase?.battleWins != null
                                ? formatNumber(summary.builderBase.battleWins)
                                : "—"}
                            </p>
                          </div>
                          <div className="cursor-help" title="Total number of days this player has been a member of the clan. Calculated from the start of their current or most recent stint. Longer tenure indicates clan loyalty and stability.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Tenure
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.tenureDays != null
                                ? `${formatNumber(summary.tenureDays)} days`
                                : "—"}
                            </p>
                            {history?.currentStint?.startDate && (
                              <p className="text-xs text-slate-400 cursor-help" title="Date when the current clan membership period began. If the player left and rejoined, this reflects the most recent join date.">
                                Since {formatDate(history.currentStint.startDate)}
                              </p>
                            )}
                          </div>
                          <div className="cursor-help" title="Alternative names this player has used (same account, different name). Separate from Linked Accounts which are different player accounts owned by the same person.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Name History
                            </p>
                            <p className="mt-2 text-sm text-slate-200">
                              {aliasList.length
                                ? aliasList.slice(0, 2).map((alias) => alias.name).join(", ")
                                : "No name changes recorded"}
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                                Linked Accounts
                              </p>
                              {canViewLeadership && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => setShowAddAliasModal(true)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add
                                </Button>
                              )}
                            </div>
                            <div className="mt-2 space-y-1">
                              {linkedAccounts.length > 0 ? (
                                linkedAccounts.map((linked) => (
                                  <div key={linked.tag} className="flex items-center justify-between text-sm">
                                    <Link
                                      href={`/player/${linked.tag.replace('#', '')}`}
                                      className="text-blue-400 hover:text-blue-300 hover:underline"
                                    >
                                      {linked.name || linked.tag}
                                    </Link>
                                    {canViewLeadership && (
                                      <button
                                        onClick={() => handleRemoveAlias(linked.tag)}
                                        className="text-red-400 hover:text-red-300 text-xs"
                                        title="Remove link"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-slate-400">No linked accounts</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </GlassCard>

                    {(timelineInsights.length > 0 || activityBreakdownRows.length > 0) && (
                      <GlassCard
                        title="Recent Activity Highlights"
                        subtitle="Snapshot of the latest seven days"
                        icon={<Activity className="h-5 w-5" />}
                        className="bg-slate-900/70 border border-slate-800/80"
                      >
                        {timelineInsights.length > 0 && (
                          <ul className="space-y-2 text-sm text-slate-200">
                            {timelineInsights.map((insight, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400" />
                                <span>{insight}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {activityBreakdownRows.length > 0 && (
                          <div
                            className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
                              timelineInsights.length > 0 ? "mt-4" : ""
                            }`}
                          >
                            {activityBreakdownRows.map((row) => (
                              <div
                                key={row.key}
                                className="flex items-center justify-between rounded-xl border border-emerald-400/10 bg-slate-900/60 px-3 py-2"
                              >
                                <div>
                                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{row.label}</p>
                                  {row.detail ? (
                                    <p className="mt-1 text-xs text-slate-300">{row.detail}</p>
                                  ) : null}
                                </div>
                                <span className="text-sm font-semibold text-slate-100">
                                  {row.score > 0 ? row.score : "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </GlassCard>
                    )}

                    <GlassCard
                      title="Hero Progress"
                      subtitle="Track levels vs. Town Hall caps"
                      icon={<Sparkles className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {(["bk", "aq", "gw", "rc", "mp"] as const).map((key) => {
                          const heroKey = key.toUpperCase() as "BK" | "AQ" | "GW" | "RC" | "MP";
                          const icon = HERO_ICON_MAP[heroKey];
                          const level = typeof heroLevels === "object" && heroLevels && key in heroLevels
                            ? Number((heroLevels as Record<string, unknown>)[key]) || 0
                            : 0;
                          const maxLevel = heroCaps && key in heroCaps
                            ? Number((heroCaps as Record<string, unknown>)[key]) || 0
                            : 0;
                          const clanAverageValue = clanHeroAverages && key in clanHeroAverages
                            ? Number(clanHeroAverages[key])
                            : null;
                          const hasClanAverage =
                            clanAverageValue !== null && Number.isFinite(clanAverageValue);
                          const diffFromClan =
                            hasClanAverage && Number.isFinite(level)
                              ? level - (clanAverageValue as number)
                              : null;
                          const diffLabel =
                            diffFromClan !== null && diffFromClan !== 0
                              ? (() => {
                                  const magnitudeLabel = Math.abs(diffFromClan).toFixed(1);
                                  const pluralSuffix = magnitudeLabel === "1.0" ? "" : "s";
                                  return diffFromClan > 0
                                    ? `Ahead of clan pace by ${magnitudeLabel} level${pluralSuffix}`
                                    : `Needs ${magnitudeLabel} level${pluralSuffix} to catch clan pace`;
                                })()
                              : hasClanAverage
                                ? "Matches clan pace"
                                : null;
                          const tooltipText =
                            hasClanAverage
                              ? (() => {
                                  const base = `${HERO_LABELS[heroKey]} level ${formatNumber(level)}. Clan average ${(clanAverageValue as number).toFixed(1)}.`;
                                  if (diffFromClan === null || diffFromClan === 0) {
                                    return base;
                                  }
                                  const magnitudeLabel = Math.abs(diffFromClan).toFixed(1);
                                  const direction = diffFromClan > 0 ? "Ahead" : "Behind";
                                  return `${base} ${direction} by ${magnitudeLabel}.`;
                                })()
                              : undefined;
                          
                          return (
                            <div key={key} className="flex items-start gap-3">
              {icon && level > 0 && (
                <div
                  className="flex-shrink-0"
                  style={{ width: '48px', height: '48px' }}
                >
                  <Image
                    src={icon.src}
                    alt={icon.alt}
                    width={48}
                    height={48}
                    className="object-contain"
                    style={{ width: '48px', height: '48px' }}
                    priority
                  />
                </div>
              )}
                              <div className="flex-1">
                                <HeroLevel
                                  hero={heroKey}
                                  level={level}
                                  maxLevel={maxLevel}
                                  showName
                                  size="lg"
                                  clanAverage={hasClanAverage ? (clanAverageValue as number) : undefined}
                                  clanAverageSource="profile"
                                  tooltip={tooltipText}
                                />
                                {diffLabel && (
                                  <p className="mt-1 text-xs text-slate-400">{diffLabel}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {Object.keys(clanHeroAverages).length > 0 && (
                        <div className="flex items-center gap-2 pt-3 text-xs text-slate-400 border-t border-slate-800/50">
                          <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full border border-slate-900/80 bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.75)]" aria-hidden="true" />
                          <span>Clan average marker (hover for sample size and gap vs clan)</span>
                        </div>
                      )}
                    </GlassCard>

                    {(summary?.builderBase?.hallLevel != null ||
                      summary?.builderBase?.trophies != null ||
                      summary?.builderBase?.battleWins != null ||
                      summary?.capitalContributions != null) && (
                      <GlassCard
                        title="Builder Base & Capital"
                        subtitle="Night Village momentum and gold contributions"
                        icon={<Hammer className="h-5 w-5" />}
                        className="bg-slate-900/70 border border-slate-800/80"
                      >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help" title="Builder Hall level in the Builder Base (Night Village). Maximum level is BH 10. Higher levels unlock more buildings and defenses.">
                            <div className="flex items-center gap-3">
                              <Hammer className="h-5 w-5 text-slate-300" />
                              <div>
                                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                                  Builder Hall
                                </p>
                                <p className="mt-1 text-lg font-semibold text-slate-100">
                                  {summary?.builderBase?.hallLevel != null
                                    ? `BH ${formatNumber(summary.builderBase.hallLevel)}`
                                    : "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help" title="Current trophy count in Builder Base Versus Battles. Trophies determine matchmaking and league placement.">
                            <div className="flex items-center gap-3">
                              <BarChart3 className="h-5 w-5 text-slate-300" />
                              <div>
                                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                                  Versus Trophies
                                </p>
                                <p className="mt-1 text-lg font-semibold text-slate-100">
                                  {summary?.builderBase?.trophies != null
                                    ? formatNumber(summary.builderBase.trophies)
                                    : "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help" title="Total wins in Builder Base Versus Battles. Each battle pits your base against another player's base in simultaneous attacks.">
                            <div className="flex items-center gap-3">
                              <Activity className="h-5 w-5 text-slate-300" />
                              <div>
                                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                                  Versus Battle Wins
                                </p>
                                <p className="mt-1 text-lg font-semibold text-slate-100">
                                  {summary?.builderBase?.battleWins != null
                                    ? formatNumber(summary.builderBase.battleWins)
                                    : "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help" title="Total capital gold contributed to Clan Capital upgrades during Raid Weekends. Higher contributions show stronger participation in clan capital development.">
                            <div className="flex items-center gap-3">
                              <Coins className="h-5 w-5 text-amber-300" />
                              <div>
                                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                                  Capital Gold
                                </p>
                                <p className="mt-1 text-lg font-semibold text-slate-100">
                                  {summary?.capitalContributions != null
                                    ? formatNumber(summary.capitalContributions)
                                    : "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    )}

                    {(achievementSummary.count != null ||
                      achievementSummary.score != null ||
                      summary?.rushPercent != null ||
                      summary?.expLevel != null) && (
                      <GlassCard
                        title="Progression Highlights"
                        subtitle="Seasonal mastery scores"
                        icon={<Medal className="h-5 w-5" />}
                        className="bg-slate-900/70 border border-slate-800/80"
                      >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div 
                            className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help"
                            title="Total number of achievements completed. Includes all types: Builder Base, Capital, Clan Games, and general gameplay achievements."
                          >
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                              Achievement Count
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {achievementSummary.count != null
                                ? formatNumber(achievementSummary.count)
                                : "—"}
                            </p>
                          </div>
                          <div 
                            className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help"
                            title="Total achievement points earned. Higher scores indicate more challenging achievements completed and greater game mastery."
                          >
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                              Achievement Score
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {achievementSummary.score != null
                                ? formatNumber(achievementSummary.score)
                                : "—"}
                            </p>
                          </div>
                          <div 
                            className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help"
                            title="Rush percentage indicates how much of the base is rushed. 0% = fully maxed, 100% = completely rushed. Lower scores show better base optimization."
                          >
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                              Rush Score
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.rushPercent != null
                                ? formatPercent(summary.rushPercent)
                                : "—"}
                            </p>
                          </div>
                          <div 
                            className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help"
                            title="Player experience level gained through gameplay activities. Earned by attacking, donating troops, and participating in clan activities."
                          >
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                              Experience Level
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.expLevel != null ? formatNumber(summary.expLevel) : "—"}
                            </p>
                          </div>
                        </div>
                      </GlassCard>
                    )}

                    {(superTroopList.length > 0 || petEntries.length > 0) && (
                      <GlassCard
                        title="Super Troops & Pets"
                        subtitle="Active boosts and companion levels"
                        icon={<Flame className="h-5 w-5" />}
                        className="bg-slate-900/70 border border-slate-800/80"
                      >
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help" title="Super Troops currently boosted with Dark Elixir. Super Troops are enhanced versions of regular troops with special abilities. Players can boost up to 2 Super Troops at a time, with each boost lasting 3 days.">
                            <div className="mb-2 flex items-center gap-2">
                              <Flame className="h-4 w-4 text-amber-400" />
                              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                                Active Super Troops
                              </p>
                            </div>
                            {superTroopList.length ? (
                              <div className="flex flex-wrap gap-2">
                                {superTroopList.map((name) => (
                                  <span
                                    key={name}
                                    className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400">
                                No super troops boosted in the latest snapshot.
                              </p>
                            )}
                          </div>
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help" title="Pet levels for each hero companion. Pets are unlocked at Town Hall 14+ and accompany heroes into battle, providing additional abilities. Higher levels increase pet effectiveness.">
                            <div className="mb-2 flex items-center gap-2">
                              <PawPrint className="h-4 w-4 text-emerald-300" />
                              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                                Pet Levels
                              </p>
                            </div>
                            {petEntries.length ? (
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {petEntries.map(([pet, level]) => (
                                  <div
                                    key={pet}
                                    className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-100"
                                  >
                                    <span>{pet}</span>
                                    <span className="font-semibold">Lv {formatNumber(level)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400">No pets recorded yet.</p>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    )}

                    {equipmentEntries.length > 0 && (
                      <GlassCard
                        title="Signature Equipment"
                        subtitle="Track hero gear levels"
                        icon={<Sparkles className="h-5 w-5" />}
                        className="bg-slate-900/70 border border-slate-800/80"
                        actions={
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowEquipmentTierModal(true)}
                            className="text-slate-300 hover:text-white hover:bg-slate-800/50"
                          >
                            More detail
                          </Button>
                        }
                      >
                        <div className="space-y-6">
                          {(() => {
                            // Group equipment by hero
                            const equipmentByHero = new Map<string, Array<[string, number]>>();
                            
                            equipmentEntries.forEach(([equipment, level]) => {
                              const tooltipData = EQUIPMENT_TOOLTIPS[equipment];
                              const hero = tooltipData?.hero || 'Unknown Hero';
                              
                              if (!equipmentByHero.has(hero)) {
                                equipmentByHero.set(hero, []);
                              }
                              equipmentByHero.get(hero)!.push([equipment, level]);
                            });
                            
                            // Sort heroes by name for consistent display
                            const sortedHeroes = Array.from(equipmentByHero.keys()).sort();
                            
                            return sortedHeroes.map((hero) => {
                              const heroEquipment = equipmentByHero.get(hero)!;
                              
                              // Map hero names to image paths using the same mapping as Hero Progress
                              const getHeroImage = (heroName: string) => {
                                switch (heroName) {
                                  case 'Barbarian King':
                                    return '/assets/heroes/Barbarian_King.png';
                                  case 'Archer Queen':
                                    return '/assets/heroes/Archer_Queen.png';
                                  case 'Grand Warden':
                                    return '/assets/heroes/Grand_Warden.png';
                                  case 'Royal Champion':
                                    return '/assets/heroes/Royal_Champion.png';
                                  case 'Minion Prince':
                                    return '/assets/heroes/Minion_Prince.png';
                                  default:
                                    return '/assets/heroes/default.png';
                                }
                              };
                              
                              return (
                                <div key={hero} className="rounded-xl border border-slate-600/50 bg-slate-800/30 p-4">
                                  {/* Hero Header */}
                                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-600/30">
                                    <img 
                                      src={getHeroImage(hero)}
                                      alt={hero}
                                      className="w-10 h-10 object-contain"
                                      onError={(e) => {
                                        // Fallback to text if image fails to load
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = document.createElement('span');
                                        fallback.textContent = hero.charAt(0);
                                        fallback.className = 'w-10 h-10 flex items-center justify-center bg-slate-600 rounded text-sm font-bold text-white';
                                        target.parentNode?.appendChild(fallback);
                                      }}
                                    />
                                    <h4 className="text-lg font-semibold text-slate-200">{hero}</h4>
                                  </div>

                                  {/* Equipment Grid */}
                                  <div className="grid grid-cols-2 gap-x-16 gap-y-4">
                                    {heroEquipment.map(([equipment, level]) => {
                                      const tooltipData = EQUIPMENT_TOOLTIPS[equipment];
                                      const tooltipTitle = tooltipData 
                                        ? `${tooltipData.hero} • ${tooltipData.tier} • ${tooltipData.rarity}\n\n${tooltipData.description}`
                                        : `Level ${formatNumber(level)} of ${EQUIPMENT_MAX_LEVELS[equipment] || '?'}`;
                                      
                                      return (
                                        <div
                                          key={equipment}
                                          className="flex justify-between items-center text-sm text-slate-200 gap-2"
                                        >
                                          <span 
                                            className="cursor-help" 
                                            title={tooltipTitle}
                                          >
                                            {equipment}
                                          </span>
                                          <span 
                                            className="font-semibold cursor-help text-slate-300" 
                                            title={`Level ${formatNumber(level)} of ${EQUIPMENT_MAX_LEVELS[equipment] || '?'}`}
                                          >
                                            {formatNumber(level)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </GlassCard>
                    )}

                    <GlassCard
                      title="Availability & Signals"
                      subtitle="Quick leadership readout"
                      icon={<Activity className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help" title="Whether the player has opted in or out of Clan Wars. War opt-in status determines if a player can be included in war matchmaking and lineups.">
                          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                            War opt-in
                          </p>
                          <p className={`mt-2 text-base font-semibold ${
                            profile?.summary?.war?.preference === 'in' 
                              ? 'text-emerald-400' 
                              : profile?.summary?.war?.preference === 'out'
                              ? 'text-orange-400'
                              : 'text-slate-400'
                          }`}>
                            {profile?.summary?.war?.preference === 'in' 
                              ? 'Opted In' 
                              : profile?.summary?.war?.preference === 'out'
                              ? 'Opted Out'
                              : 'Not Set'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {profile?.summary?.war?.preference 
                              ? `Player preference: ${profile.summary.war.preference.toUpperCase()}`
                              : 'War preference not available'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 cursor-help" title="Current membership status in the clan. 'Member' = regular member, 'Elder' = has elder privileges, 'Co-Leader' = has co-leader privileges, 'Leader' = clan leader. Status determines permissions and responsibilities.">
                          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                            Join status
                          </p>
                          <p className="mt-2 text-base font-semibold text-slate-100">
                            {history?.status ? history.status.toUpperCase() : "Unknown"}
                          </p>
                          {history?.currentStint?.startDate ? (
                            <p className="text-xs text-slate-400 cursor-help" title="Date when the current clan membership period began. If the player left and rejoined, this reflects the most recent join date.">
                              Current stint started {formatRelative(history.currentStint.startDate)}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400">
                              No active stint start recorded
                            </p>
                          )}
                        </div>
                        {canViewLeadership && (
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 md:col-span-2 cursor-help" title="Most recent leadership note for this player. Leadership notes are used to capture context, coaching feedback, follow-ups, or important observations about the player's performance or behavior. Only visible to leadership members.">
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                              Leadership spotlight
                            </p>
                            {latestNote ? (
                              <div className="mt-2">
                                <p className="text-sm font-medium text-slate-100">
                                  {latestNote.note}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Logged {formatRelative(latestNote.createdAt)}
                                  {latestNote.createdBy ? ` • ${latestNote.createdBy}` : ""}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-slate-400">
                                No leadership notes yet — add one to capture context.
                              </p>
                            )}
                            {activeWarning && (
                              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-200 shadow-[0_20px_45px_-30px_rgba(251,191,36,0.8)]">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold">Active warning on file</p>
                                    <p className="mt-1 text-xs text-amber-100/80">
                                      {activeWarning.warningNote}
                                    </p>
                                  </div>
                                  {activeWarning.warningNote?.includes('[Propagated from') && (
                                    <span className="ml-2 text-xs text-amber-300/70 bg-amber-500/20 px-2 py-1 rounded" title="This warning was propagated from a linked alias account">
                                      Linked
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </GlassCard>

                  </div>

                  <div className="space-y-6">
                    {canViewLeadership && (
                      <GlassCard
                        title="Leadership Quick Actions"
                        subtitle="Every action routes through Supabase APIs"
                        icon={<Sparkles className="h-5 w-5" />}
                        className="bg-slate-900/70 border border-slate-800/80"
                      >
                        <div className="flex flex-col gap-3">
                          <Button
                            variant="primary"
                            className="justify-start gap-2 rounded-2xl px-4"
                            onClick={() => setShowNoteModal(true)}
                          >
                            <Plus className="h-4 w-4" />
                            Add leadership note
                          </Button>
                          <Button
                            variant="warning"
                            className="justify-start gap-2 rounded-2xl px-4"
                            onClick={() => setShowWarningModal(true)}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Mark warning
                          </Button>
                          <Button
                            variant="secondary"
                            className="justify-start gap-2 rounded-2xl px-4"
                            onClick={() =>
                              showToast("Tenure actions land once the Supabase mutation is ready.", "info")
                            }
                          >
                            <UserCheck className="h-4 w-4" />
                            Adjust tenure (soon)
                          </Button>
                        </div>
                      </GlassCard>
                    )}

                    <GlassCard
                      title="Watchlist & Flags"
                      subtitle="Snapshot of risk + recruiting context"
                      icon={<AlertTriangle className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="space-y-4 text-sm text-slate-200">
                        <div className="flex items-center justify-between">
                          <span>Warning status</span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              activeWarning
                                ? "bg-amber-500/20 text-amber-200"
                                : "bg-emerald-500/20 text-emerald-200"
                            }`}
                          >
                            {activeWarning ? "Active" : "Clear"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Applicant evaluations</span>
                          <span className="text-slate-300">
                            {profile?.evaluations?.length
                              ? `${profile.evaluations.length} on file`
                              : "None recorded"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Joiner radar</span>
                          <span className="text-slate-300">
                            {profile?.joinerEvents?.length
                              ? `Last detected ${formatRelative(
                                  profile.joinerEvents[profile.joinerEvents.length - 1]
                                    ?.detectedAt ?? null,
                                ) ?? "recently"}`
                              : "No joiner events yet"}
                          </span>
                        </div>
                      </div>
                    </GlassCard>

                    <GlassCard
                      title="Related Links"
                      subtitle="Jump into supporting workflows"
                      icon={<ExternalLink className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="flex flex-col gap-3 text-sm text-indigo-200">
                        <Link
                          href={`/player/${encodeURIComponent(plainTag)}/history`}
                          className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 transition hover:border-indigo-400 hover:bg-indigo-500/20"
                        >
                          View raw history analytics
                        </Link>
                        <button
                          type="button"
                          onClick={handleOpenInClash}
                          className="rounded-2xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-left transition hover:border-slate-600 hover:bg-slate-900/80"
                        >
                          Open in Clash client
                        </button>
                        <button
                          type="button"
                          onClick={handleCopySummary}
                          className="rounded-2xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-left transition hover:border-slate-600 hover:bg-slate-900/80"
                        >
                          Copy leadership summary
                        </button>
                      </div>
                    </GlassCard>
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-6">
                  {milestoneHighlights.length > 0 && (
                    <GlassCard
                      title="Milestone Highlights"
                      subtitle="Key accomplishments captured in the daily ledger"
                      icon={<Award className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {milestoneHighlights.map((highlight) => (
                          <div
                            key={highlight.id}
                            className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/80 px-4 py-3"
                          >
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-700/70 bg-slate-800/90 shadow-inner">
                              {milestoneIcon(highlight.kind)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-100">{highlight.title}</span>
                              <span className="text-xs text-slate-300">{highlight.detail}</span>
                              <span className="text-[11px] text-slate-500 mt-1 uppercase tracking-wide">
                                {highlight.dateDisplay}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  )}

                  {(timelineInsights.length > 0 || activityBreakdownRows.length > 0) && (
                    <GlassCard
                      title="Activity Streaks & Highlights"
                      subtitle="Recent performance patterns and milestones"
                      icon={<Flame className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      {timelineInsights.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {timelineInsights.map((insight, index) => (
                            <div key={index} className="flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-900/80 px-4 py-3">
                              <div className="flex-shrink-0">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/30">
                                  <Flame className="h-4 w-4 text-amber-400" />
                                </div>
                              </div>
                              <p className="text-sm font-medium text-slate-200">{insight}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {activityBreakdownRows.length > 0 && (
                        <div
                          className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
                            timelineInsights.length > 0 ? "mt-4" : ""
                          }`}
                        >
                          {activityBreakdownRows.map((row) => (
                            <div
                              key={row.key}
                              className="flex items-center justify-between rounded-xl border border-emerald-400/10 bg-slate-900/60 px-4 py-3"
                            >
                              <div>
                                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                                  {row.label}
                                </p>
                                {row.detail ? (
                                  <p className="mt-1 text-xs text-slate-300">{row.detail}</p>
                                ) : null}
                              </div>
                              <span className="text-sm font-semibold text-slate-100">
                                {row.score > 0 ? row.score : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </GlassCard>
                  )}

                  <GlassCard
                    title="Timeline"
                    subtitle="Movements, leadership actions, and joiner events"
                    icon={<History className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                  >
                    {timelineItems.length ? (
                      <div className="relative border-l border-slate-800/70 pl-8">
                        <div className="absolute -left-[13px] top-0 h-3 w-3 rounded-full border border-slate-600 bg-slate-900/90" />
                        <div className="space-y-6">
                          {timelineItems.map((item) => (
                            <div key={item.id} className="relative pl-4">
                              <div
                                className={`absolute -left-[34px] top-1 flex h-8 w-8 items-center justify-center rounded-full border ${timelineIconClass(item.tone)}`}
                              >
                                <TimelineIcon type={item.icon} />
                              </div>
                              <div className="flex flex-col gap-1 rounded-2xl border border-slate-800/60 bg-slate-900/70 p-4 shadow-[0_20px_45px_-40px_rgba(15,23,42,0.95)]">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <h4 className="text-sm font-semibold text-slate-100">
                                    {item.title}
                                  </h4>
                                  <span className="text-xs text-slate-400">
                                    {formatDate(item.date)}
                                  </span>
                                </div>
                                {item.description && (
                                  <p className="text-sm text-slate-300">{item.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
                        We have not ingested any timeline events for this player yet.
                      </p>
                    )}
                  </GlassCard>

                  {aliasList.length > 0 && (
                    <GlassCard
                      title="Alias History"
                      subtitle="Known name changes and sightings"
                      icon={<Sparkles className="h-5 w-5" />}
                      className="bg-slate-900/70 border border-slate-800/80"
                    >
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {aliasList.map((alias) => (
                          <div
                            key={`${alias.name}-${alias.firstSeen}`}
                            className="rounded-2xl border border-slate-800/60 bg-slate-900/70 px-4 py-4"
                          >
                            <p className="text-sm font-semibold text-slate-100">{alias.name}</p>
                            <p className="text-xs text-slate-400">
                              First seen {formatDate(alias.firstSeen)}
                            </p>
                            <p className="text-xs text-slate-400">
                              Last seen {formatDate(alias.lastSeen)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  )}
                </div>
              )}

              {activeTab === "evaluations" && (
                <div className="space-y-6">
                  <GlassCard
                    title="Applicant Evaluations"
                    subtitle="Latest recruiting readouts"
                    icon={<SquarePen className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                    actions={
                      canViewLeadership && (
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            className="gap-2"
                            onClick={() =>
                              showToast(
                                "Status transitions hook into the applicant pipeline next sprint.",
                                "info",
                              )
                            }
                          >
                            Update status
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2"
                            onClick={() =>
                              showToast(
                                "Evaluation notes will be editable once the modal lands.",
                                "info",
                              )
                            }
                          >
                            Add evaluation note
                          </Button>
                        </div>
                      )
                    }
                  >
                    {profile?.evaluations?.length ? (
                      <div className="space-y-4">
                        <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5 text-indigo-100">
                          <p className="text-xs uppercase tracking-[0.28em] text-indigo-200/70">
                            Latest evaluation
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            Score{" "}
                            {profile.evaluations[profile.evaluations.length - 1]?.score != null
                              ? profile.evaluations[
                                  profile.evaluations.length - 1
                                ]?.score?.toFixed(1)
                              : "—"}
                          </p>
                          <p className="text-sm text-indigo-100/80">
                            {profile.evaluations[profile.evaluations.length - 1]?.recommendation ??
                              "No recommendation captured"}
                          </p>
                          <p className="mt-1 text-xs text-indigo-100/70">
                            {formatRelative(
                              profile.evaluations[profile.evaluations.length - 1]?.updatedAt ??
                                null,
                            ) ?? "Timing unknown"}
                          </p>
                        </div>

                        <div className="overflow-hidden rounded-3xl border border-slate-800/80">
                          <table className="min-w-full divide-y divide-slate-800/80 text-sm text-slate-200">
                            <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.28em] text-slate-400">
                              <tr>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Score</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3 text-left">Recommendation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900/70 bg-slate-950/40">
                              {profile.evaluations
                                .slice()
                                .reverse()
                                .map((evaluation) => (
                                  <tr key={evaluation.id}>
                                    <td className="px-4 py-3 text-slate-300">
                                      {formatDate(evaluation.updatedAt ?? evaluation.createdAt)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-100">
                                      {evaluation.score != null
                                        ? evaluation.score.toFixed(1)
                                        : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-slate-200">
                                      {evaluation.status ?? "—"}
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">
                                      {evaluation.recommendation ?? "No note"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
                        No applicant evaluations yet — sync the recruiting sheet or run the
                        interview workflow to populate this tab.
                      </p>
                    )}
                  </GlassCard>
                </div>
              )}

              {activeTab === "analysis" && (
                <div className="space-y-6">
                  {(() => {
                    const { playerDNA, playerArchetype, clanAverageDNA, dnaBreakdown, playerStats, clanStatsAverages } = analysisData;

                    return (
                      <>
                        {/* Radar Charts Side-by-Side */}
                        {(playerDNA && playerArchetype) || (playerStats && clanStatsAverages) ? (
                          <GlassCard
                            title="Player Analysis"
                            subtitle="DNA profile and performance comparison"
                            icon={<Target className="h-5 w-5" />}
                            className="bg-gradient-to-br from-slate-900/90 via-indigo-900/30 to-slate-900/90 border border-slate-800/80 shadow-[0_20px_60px_-30px_rgba(99,102,241,0.3)]"
                          >
                            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                              {/* Player DNA Radar Chart */}
                              {playerDNA && playerArchetype && (
                                <div className="flex flex-col">
                                  <div className="mb-4 flex items-center gap-2">
                                    <Target className="h-4 w-4 text-indigo-400" />
                                    <h3 
                                      className="text-sm font-semibold text-slate-200 cursor-help"
                                      title="Player DNA Profile: A multi-dimensional classification system that analyzes players across six core dimensions. Each dimension (0-100) measures a different aspect of player behavior and contribution. The radar chart visualizes how the player compares to clan averages (dashed line) in each dimension. The archetype is automatically determined based on the player's DNA pattern."
                                    >
                                      Player DNA Profile
                                    </h3>
                                  </div>
                                  <div 
                                    className="relative flex justify-center py-4 cursor-pointer group transition-all duration-200 hover:scale-[1.02]"
                                    onClick={() => setExpandedChart('dna')}
                                    title="Click to view larger chart"
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 rounded-3xl blur-3xl group-hover:from-indigo-500/20 group-hover:to-purple-500/20 transition-colors" />
                                    <PlayerDNARadar
                                      dna={playerDNA}
                                      archetype={playerArchetype as any}
                                      playerName=""
                                      size={420}
                                      showName={false}
                                      clanAverageDNA={clanAverageDNA}
                                    />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800/90 backdrop-blur-sm px-2 py-1 rounded text-xs text-slate-300 border border-slate-700">
                                      Click to expand
                                    </div>
                                  </div>
                                  <div className="mt-3 grid grid-cols-3 gap-2">
                                    <div 
                                      className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1.5 backdrop-blur-sm cursor-help"
                                      title={dnaBreakdown?.leadership || "Leadership: Calculation not available"}
                                    >
                                      <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400">Leadership</p>
                                      <p className="mt-0.5 text-base font-bold text-indigo-300">{playerDNA.leadership}</p>
                                    </div>
                                    <div 
                                      className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1.5 backdrop-blur-sm cursor-help"
                                      title={dnaBreakdown?.performance || "Performance: Calculation not available"}
                                    >
                                      <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400">Performance</p>
                                      <p className="mt-0.5 text-base font-bold text-indigo-300">{playerDNA.performance}</p>
                                    </div>
                                    <div 
                                      className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1.5 backdrop-blur-sm cursor-help"
                                      title={dnaBreakdown?.generosity || "Generosity: Calculation not available"}
                                    >
                                      <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400">Generosity</p>
                                      <p className="mt-0.5 text-base font-bold text-indigo-300">{playerDNA.generosity}</p>
                                    </div>
                                    <div 
                                      className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1.5 backdrop-blur-sm cursor-help"
                                      title={dnaBreakdown?.social || "Social: Calculation not available"}
                                    >
                                      <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400">Social</p>
                                      <p className="mt-0.5 text-base font-bold text-indigo-300">{playerDNA.social}</p>
                                    </div>
                                    <div 
                                      className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1.5 backdrop-blur-sm cursor-help"
                                      title={dnaBreakdown?.specialization || "Specialization: Calculation not available"}
                                    >
                                      <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400">Specialization</p>
                                      <p className="mt-0.5 text-base font-bold text-indigo-300">{playerDNA.specialization}</p>
                                    </div>
                                    <div 
                                      className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1.5 backdrop-blur-sm cursor-help"
                                      title={dnaBreakdown?.consistency || "Consistency: Calculation not available"}
                                    >
                                      <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400">Consistency</p>
                                      <p className="mt-0.5 text-base font-bold text-indigo-300">{playerDNA.consistency}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Stats Comparison Radar Chart */}
                              {playerStats && clanStatsAverages && (
                                <div className="flex flex-col">
                                  <div className="mb-4 flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-blue-400" />
                                    <h3 
                                      className="text-sm font-semibold text-slate-200 cursor-help"
                                      title="Performance vs Clan Average: This radar chart compares your key stats to your clan's averages. The solid blue line represents your values, while the dashed gray line shows the clan average. Values above the clan average (50%+ on the chart) indicate you're performing better than average in that area. The percentage shown for each metric indicates how much above or below average you are."
                                    >
                                      Performance vs Clan Average
                                    </h3>
                                  </div>
                                  <div 
                                    className="relative flex justify-center py-4 cursor-pointer group transition-all duration-200 hover:scale-[1.02]"
                                    onClick={() => setExpandedChart('stats')}
                                    title="Click to view larger chart"
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10 rounded-3xl blur-3xl group-hover:from-blue-500/20 group-hover:to-cyan-500/20 transition-colors" />
                                    <StatsRadarChart
                                      playerStats={playerStats}
                                      clanAverages={clanStatsAverages}
                                      playerName=""
                                      size={420}
                                      showName={false}
                                    />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800/90 backdrop-blur-sm px-2 py-1 rounded text-xs text-slate-300 border border-slate-700">
                                      Click to expand
                                    </div>
                                  </div>
                                  <div className="mt-3 grid grid-cols-3 gap-2">
                                    {[
                                      { 
                                        label: 'Trophies', 
                                        player: playerStats.trophies, 
                                        avg: clanStatsAverages.trophies,
                                        tooltip: "Current trophy count. Higher trophies indicate stronger competitive performance and higher league placement. Ranked Battle Trophies are used if available."
                                      },
                                      { 
                                        label: 'Donations', 
                                        player: playerStats.donations, 
                                        avg: clanStatsAverages.donations,
                                        tooltip: "Total troops donated to clan members. Higher donations show stronger clan support and generosity. Includes all troop types donated throughout the season."
                                      },
                                      { 
                                        label: 'War Stars', 
                                        player: playerStats.warStars, 
                                        avg: clanStatsAverages.warStars,
                                        tooltip: "Total stars earned in Clan Wars. Each successful attack can earn up to 3 stars. Higher totals indicate more war participation and successful attacks."
                                      },
                                      { 
                                        label: 'Capital', 
                                        player: playerStats.capitalContributions, 
                                        avg: clanStatsAverages.capitalContributions,
                                        tooltip: "Total capital gold contributed to Clan Capital upgrades during Raid Weekends. Higher contributions show stronger participation in clan capital development."
                                      },
                                      { 
                                        label: 'Town Hall', 
                                        player: playerStats.townHallLevel, 
                                        avg: clanStatsAverages.townHallLevel,
                                        tooltip: "Town Hall level (1-16). Higher levels unlock more buildings, defenses, and troops. Indicates overall base progression and power level."
                                      },
                                      { 
                                        label: 'VIP Score', 
                                        player: playerStats.vipScore, 
                                        avg: clanStatsAverages.vipScore,
                                        tooltip: "VIP (Very Important Player) Score: Combined measure of competitive performance (50%), support activities (30%), and base development (20%). Higher scores indicate well-rounded, valuable clan members."
                                      },
                                    ].map(({ label, player, avg, tooltip }) => {
                                      const diff = avg > 0 ? ((player - avg) / avg) * 100 : 0;
                                      const isPositive = diff >= 0;
                                      return (
                                        <div 
                                          key={label} 
                                          className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1.5 backdrop-blur-sm cursor-help"
                                          title={tooltip}
                                        >
                                          <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400">{label}</p>
                                          <p className="mt-0.5 text-base font-bold text-blue-300">{formatNumber(player)}</p>
                                          <div className="mt-0.5 flex items-baseline gap-1">
                                            <p className="text-[8px] text-slate-500">vs {formatNumber(Math.round(avg))}</p>
                                            <p className={`text-[8px] font-semibold ${isPositive ? 'text-emerald-400' : 'text-orange-400'}`}>
                                              {isPositive ? '+' : ''}{diff.toFixed(0)}%
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </GlassCard>
                        ) : null}

                        {(!playerDNA || !playerStats) && (
                          <GlassCard
                            title="Analysis Data Unavailable"
                            subtitle="Player analysis requires roster data"
                            icon={<Target className="h-5 w-5" />}
                            className="bg-slate-900/70 border border-slate-800/80"
                          >
                            <p className="text-sm text-slate-400">
                              {!rosterMember 
                                ? "Unable to load player data from roster. Please ensure the player is in the current clan."
                                : "Clan averages are not yet available. Analysis will appear once clan data is processed."}
                            </p>
                          </GlassCard>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {activeTab === "metrics" && (
                <div className="space-y-6">
                  <GlassCard
                    title="Daily Activity Analysis"
                    subtitle="Activity scoring with detailed breakdown and metrics"
                    icon={<Activity className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                  >
                    <PlayerActivityAnalytics 
                      data={profile?.timeline?.filter(point => point.snapshotDate).map(point => ({
                        date: point.snapshotDate!,
                        deltas: {
                          trophies: (point.deltas as any)?.trophies || 0,
                          donations: (point.deltas as any)?.donations || 0,
                          war_stars: (point.deltas as any)?.war_stars || 0,
                          capital_contrib: (point.deltas as any)?.capital_contrib || 0,
                        }
                      })) ?? []}
                      playerName={summary?.name || "Player"}
                      memberData={summary ? {
                        name: summary.name ?? summary.tag,
                        tag: summary.tag,
                        role: summary.role ?? undefined,
                        townHallLevel: summary.townHallLevel ?? undefined,
                        trophies: summary.trophies ?? undefined,
                        rankedTrophies: summary.rankedTrophies ?? undefined,
                        rankedLeagueId: summary.rankedLeague.id ?? undefined,
                        rankedLeagueName: summary.rankedLeague.name ?? undefined,
                        donations: summary.donations.given ?? undefined,
                        donationsReceived: summary.donations.received ?? undefined,
                        seasonTotalTrophies: summary.seasonTotalTrophies ?? undefined,
                        enriched: {
                          warStars: summary.war.stars ?? null,
                          attackWins: summary.war.attackWins ?? null,
                          defenseWins: summary.war.defenseWins ?? null,
                          capitalContributions: summary.capitalContributions ?? null,
                          builderHallLevel: summary.builderBase.hallLevel ?? null,
                          versusTrophies: summary.builderBase.trophies ?? null,
                          versusBattleWins: summary.builderBase.battleWins ?? null,
                          builderLeagueId: summary.builderBase.leagueId ?? null,
                          builderLeagueName: summary.builderBase.leagueName ?? null,
                          achievementCount: summary.achievements.count ?? null,
                          achievementScore: summary.achievements.score ?? null,
                          expLevel: summary.expLevel ?? null,
                          bestTrophies: summary.bestTrophies ?? null,
                          bestVersusTrophies: summary.bestVersusTrophies ?? null,
                          equipmentLevels: summary.equipmentLevels ?? null,
                          petLevels: summary.pets ?? null,
                          superTroopsActive: summary.superTroopsActive ?? null,
                        } as any,
                        activity: summary.activity ?? undefined,
                      } as Member : undefined}
                    />
                  </GlassCard>

                  <GlassCard
                    title="Trophy & Donation Trends"
                    subtitle="Ranked season snapshots via nightly ingestion"
                    icon={<BarChart3 className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                  >
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <TrophyChart data={(() => {
                        if (!profile?.timeline) return [];
                        const rankedStartDateStr = '2025-10-06';
                        const filtered = profile.timeline.filter(point => {
                          if (!point.snapshotDate) return false;
                          // snapshotDate comes as YYYY-MM-DD string (e.g., "2025-10-05")
                          const pointDateStr = String(point.snapshotDate).substring(0, 10);
                          // Strictly exclude Oct 5 and earlier - must be >= Oct 6
                          const isAfterStart = pointDateStr >= rankedStartDateStr;
                          if (!isAfterStart) {
                            console.warn('[PlayerProfile] Filtering out Oct 5 date:', pointDateStr, point);
                          }
                          return isAfterStart;
                        });
                        console.log('[PlayerProfile] TrophyChart data:', {
                          total: profile.timeline.length,
                          filtered: filtered.length,
                          firstDate: filtered[0]?.snapshotDate,
                          lastDate: filtered[filtered.length - 1]?.snapshotDate
                        });
                        return filtered.map(point => ({
                          date: point.snapshotDate!,
                          trophies: point.trophies,
                          rankedTrophies: point.rankedTrophies
                        }));
                      })()} />
                      <DonationChart data={donationSeries} />
                    </div>
                  </GlassCard>

                  <GlassCard
                    title="War Contribution Pulse"
                    subtitle="High-level indicators — full hit-rate tracking ships later"
                    icon={<Activity className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 px-4 py-4 cursor-help" title="Total war stars earned across all Clan Wars. Each successful attack can earn up to 3 stars based on destruction percentage. Higher totals indicate more war participation and successful attacks.">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                          War stars
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-slate-100">
                          {summary?.war?.stars != null ? formatNumber(summary.war.stars) : "—"}
                        </p>
                        <p className="text-xs text-slate-400">
                          Pull detailed performance once war logs are ingested.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 px-4 py-4 cursor-help" title="Total number of successful war attacks where the player earned stars. Offensive wins track how many times a player successfully attacked enemy bases in Clan Wars, contributing to overall war performance.">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                          Offensive wins
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-slate-100">
                          {summary?.war?.attackWins != null
                            ? formatNumber(summary.war.attackWins)
                            : "—"}
                        </p>
                        <p className="text-xs text-slate-400">
                          Hit-rate logging aligns with the war event sync roadmap.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 px-4 py-4 cursor-help" title="Total number of successful defensive holds in Clan Wars. Defensive holds occur when the player's base successfully defends against enemy attacks, preventing the attacker from earning 3 stars.">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                          Defensive holds
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-slate-100">
                          {summary?.war?.defenseWins != null
                            ? formatNumber(summary.war.defenseWins)
                            : "—"}
                        </p>
                        <p className="text-xs text-slate-400">
                          Defensive analytics unlock after the war parser rollout.
                        </p>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard
                    title="Leadership Kudos"
                    subtitle="Auto-suggested recognition hooks"
                    icon={<Sparkles className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                  >
                    <p className="text-sm text-slate-200">{kudosSuggestion}</p>
                  </GlassCard>
                </div>
              )}

              {activeTab === "comparison" && (
                <PlayerComparisonView
                  playerTag={normalizedTag}
                  playerName={summary?.name ?? undefined}
                  playerTrophies={summary?.seasonTotalTrophies ?? summary?.bestTrophies ?? summary?.trophies ?? summary?.rankedTrophies ?? undefined}
                  playerTownHall={summary?.townHallLevel ?? undefined}
                  playerLeagueName={summary?.rankedLeague.name ?? summary?.league.name ?? undefined}
                  clanTag={clanTag}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {canViewLeadership && (
        <Modal
          isOpen={showNoteModal}
          onClose={() => {
            if (!noteSaving) {
              setShowNoteModal(false);
              setNoteText("");
            }
          }}
          title="Add leadership note"
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Notes sync straight to Supabase so every leadership touchpoint stays in lockstep.
            </p>
            <textarea
              className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-800 shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Capture coaching notes, context, or follow-ups…"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              disabled={noteSaving}
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  if (!noteSaving) {
                    setShowNoteModal(false);
                    setNoteText("");
                  }
                }}
                disabled={noteSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveNote}
                loading={noteSaving}
                disabled={!noteText.trim()}
              >
                Save note
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {canViewLeadership && showAddAliasModal && (
        <Modal
          isOpen={showAddAliasModal}
          onClose={() => {
            if (!aliasSaving) {
              setShowAddAliasModal(false);
              setAliasTagInput("");
            }
          }}
          title="Link Player Account"
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Link a separate player account (alias) to this player. When any linked account receives a warning, all linked accounts will inherit it.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Player Tag
              </label>
              <input
                type="text"
                value={aliasTagInput}
                onChange={(e) => setAliasTagInput(e.target.value)}
                placeholder="#ABC123XYZ"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={aliasSaving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !aliasSaving && aliasTagInput.trim()) {
                    handleAddAlias();
                  }
                }}
              />
              <p className="mt-1 text-xs text-slate-400">
                Enter the player tag of the account to link (e.g., #ABC123XYZ)
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddAliasModal(false);
                  setAliasTagInput("");
                }}
                disabled={aliasSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAddAlias}
                disabled={aliasSaving || !aliasTagInput.trim()}
              >
                {aliasSaving ? "Linking..." : "Link Account"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {canViewLeadership && (
        <Modal
          isOpen={showWarningModal}
          onClose={() => {
            if (!warningSaving) {
              setShowWarningModal(false);
              setWarningText("");
            }
          }}
          title="Mark warning"
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Warning notes replace any existing active warning for this player. Use them when
              leadership alignment is critical.
            </p>
            <textarea
              className="min-h-[140px] w-full rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="Outline the risk and next follow-up steps…"
              value={warningText}
              onChange={(event) => setWarningText(event.target.value)}
              disabled={warningSaving}
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  if (!warningSaving) {
                    setShowWarningModal(false);
                    setWarningText("");
                  }
                }}
                disabled={warningSaving}
              >
                Cancel
              </Button>
              <Button
                variant="warning"
                onClick={handleSaveWarning}
                loading={warningSaving}
                disabled={!warningText.trim()}
              >
                Save warning
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={showEquipmentTierModal}
        onClose={() => setShowEquipmentTierModal(false)}
        title="Equipment Tier Guide"
        size="lg"
      >
        <div className="space-y-6">
          <p className="text-sm text-slate-600">
          Equipment tiers are a competitive ranking system that assesses an equipment piece&rsquo;s effectiveness, utility, and priority for upgrade within the current meta.
          </p>
          
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-bold text-red-600">S Tier</span>
                <span className="text-sm text-red-500">Superior/Strategic</span>
              </div>
              <p className="text-sm text-red-700 mb-2">
                The best and most powerful equipment available, providing the largest competitive edge and should be prioritized for maximum upgrades.
              </p>
              <p className="text-xs text-red-600">
                Examples: Spiky Ball, Earthquake Boots, Magic Mirror, Dark Orb, Eternal Tome, Fireball, Healing Tome
              </p>
            </div>

            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-bold text-orange-600">A Tier</span>
                <span className="text-sm text-orange-500">Excellent/High Value</span>
              </div>
              <p className="text-sm text-orange-700 mb-2">
                Highly effective and strong equipment, often serving as critical components in top strategies.
              </p>
              <p className="text-xs text-orange-600">
                Examples: Giant Gauntlet, Seeking Shield, Vampstache, Giant Arrow, Healer Puppet, Hog Rider Puppet, Noble Iron
              </p>
            </div>

            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-bold text-yellow-600">B Tier</span>
                <span className="text-sm text-yellow-500">Average/Situational</span>
              </div>
              <p className="text-sm text-yellow-700 mb-2">
                Decent equipment that is highly useful when paired with S-Tier items or specific armies.
              </p>
              <p className="text-xs text-yellow-600">
                Examples: Rage Vial, Invisibility Vial, Rage Gem, Metal Pants, Haste Vial
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-bold text-blue-600">C Tier</span>
                <span className="text-sm text-blue-500">Situational/Below Average</span>
              </div>
              <p className="text-sm text-blue-700 mb-2">
                Equipment that is generally outclassed or highly inconsistent, making them low priority for valuable resources like Ore.
              </p>
              <p className="text-xs text-blue-600">
                Examples: Archer Puppet, Barbarian Puppet, Life Gem, Frozen Arrow, Heroic Torch
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-bold text-gray-600">D Tier</span>
                <span className="text-sm text-gray-500">Lowest Rank</span>
              </div>
              <p className="text-sm text-gray-700 mb-2">
                Equipment pieces typically considered the least impactful, having the lowest DPS/HP even at max level, or serving only minor functions.
              </p>
              <p className="text-xs text-gray-600">
                Examples: Royal Gem, Lavaloon Puppet
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => setShowEquipmentTierModal(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      {/* Expanded Radar Chart Modal */}
      <Modal
        isOpen={expandedChart !== null}
        onClose={() => setExpandedChart(null)}
        title={expandedChart === 'dna' ? 'Player DNA Profile' : 'Performance vs Clan Average'}
        size="2xl"
        className="bg-slate-900/95 border border-slate-800"
      >
        {expandedChart === 'dna' && analysisData.playerDNA && analysisData.playerArchetype && (
          <div className="space-y-6">
            <div className="relative flex justify-center py-6">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 rounded-3xl blur-3xl" />
              <PlayerDNARadar
                dna={analysisData.playerDNA}
                archetype={analysisData.playerArchetype as any}
                playerName={summary?.name ?? ""}
                size={700}
                showName={true}
                clanAverageDNA={analysisData.clanAverageDNA}
              />
            </div>
            {analysisData.dnaBreakdown && (
              <div className="grid grid-cols-3 gap-3">
                <div 
                  className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 backdrop-blur-sm cursor-help"
                  title={analysisData.dnaBreakdown.leadership}
                >
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Leadership</p>
                  <p className="mt-1 text-xl font-bold text-indigo-300">{analysisData.playerDNA.leadership}</p>
                </div>
                <div 
                  className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 backdrop-blur-sm cursor-help"
                  title={analysisData.dnaBreakdown.performance}
                >
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Performance</p>
                  <p className="mt-1 text-xl font-bold text-indigo-300">{analysisData.playerDNA.performance}</p>
                </div>
                <div 
                  className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 backdrop-blur-sm cursor-help"
                  title={analysisData.dnaBreakdown.generosity}
                >
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Generosity</p>
                  <p className="mt-1 text-xl font-bold text-indigo-300">{analysisData.playerDNA.generosity}</p>
                </div>
                <div 
                  className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 backdrop-blur-sm cursor-help"
                  title={analysisData.dnaBreakdown.social}
                >
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Social</p>
                  <p className="mt-1 text-xl font-bold text-indigo-300">{analysisData.playerDNA.social}</p>
                </div>
                <div 
                  className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 backdrop-blur-sm cursor-help"
                  title={analysisData.dnaBreakdown.specialization}
                >
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Specialization</p>
                  <p className="mt-1 text-xl font-bold text-indigo-300">{analysisData.playerDNA.specialization}</p>
                </div>
                <div 
                  className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 backdrop-blur-sm cursor-help"
                  title={analysisData.dnaBreakdown.consistency}
                >
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Consistency</p>
                  <p className="mt-1 text-xl font-bold text-indigo-300">{analysisData.playerDNA.consistency}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {expandedChart === 'stats' && analysisData.playerStats && analysisData.clanStatsAverages && (
          <div className="space-y-6">
            <div className="relative flex justify-center py-6">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10 rounded-3xl blur-3xl" />
              <StatsRadarChart
                playerStats={analysisData.playerStats}
                clanAverages={analysisData.clanStatsAverages}
                playerName={summary?.name ?? ""}
                size={700}
                showName={true}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { 
                  label: 'Trophies', 
                  player: analysisData.playerStats.trophies, 
                  avg: analysisData.clanStatsAverages.trophies,
                  tooltip: "Current trophy count. Higher trophies indicate stronger competitive performance and higher league placement. Ranked Battle Trophies are used if available."
                },
                { 
                  label: 'Donations', 
                  player: analysisData.playerStats.donations, 
                  avg: analysisData.clanStatsAverages.donations,
                  tooltip: "Total troops donated to clan members. Higher donations show stronger clan support and generosity. Includes all troop types donated throughout the season."
                },
                { 
                  label: 'War Stars', 
                  player: analysisData.playerStats.warStars, 
                  avg: analysisData.clanStatsAverages.warStars,
                  tooltip: "Total stars earned in Clan Wars. Each successful attack can earn up to 3 stars. Higher totals indicate more war participation and successful attacks."
                },
                { 
                  label: 'Capital', 
                  player: analysisData.playerStats.capitalContributions, 
                  avg: analysisData.clanStatsAverages.capitalContributions,
                  tooltip: "Total capital gold contributed to Clan Capital upgrades during Raid Weekends. Higher contributions show stronger participation in clan capital development."
                },
                { 
                  label: 'Town Hall', 
                  player: analysisData.playerStats.townHallLevel, 
                  avg: analysisData.clanStatsAverages.townHallLevel,
                  tooltip: "Town Hall level (1-16). Higher levels unlock more buildings, defenses, and troops. Indicates overall base progression and power level."
                },
                { 
                  label: 'VIP Score', 
                  player: analysisData.playerStats.vipScore, 
                  avg: analysisData.clanStatsAverages.vipScore,
                  tooltip: "VIP (Very Important Player) Score: Combined measure of competitive performance (50%), support activities (30%), and base development (20%). Higher scores indicate well-rounded, valuable clan members."
                },
              ].map(({ label, player, avg, tooltip }) => {
                const diff = avg > 0 ? ((player - avg) / avg) * 100 : 0;
                const isPositive = diff >= 0;
                return (
                  <div 
                    key={label} 
                    className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 backdrop-blur-sm cursor-help"
                    title={tooltip}
                  >
                    <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">{label}</p>
                    <p className="mt-1 text-xl font-bold text-blue-300">{formatNumber(player)}</p>
                    <div className="mt-1 flex items-baseline gap-1">
                      <p className="text-[9px] text-slate-500">vs {formatNumber(Math.round(avg))}</p>
                      <p className={`text-[9px] font-semibold ${isPositive ? 'text-emerald-400' : 'text-orange-400'}`}>
                        {isPositive ? '+' : ''}{diff.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

    </DashboardLayout>
  );
}
