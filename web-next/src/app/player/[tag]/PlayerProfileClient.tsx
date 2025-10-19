"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clipboard,
  Coins,
  ExternalLink,
  Flame,
  Hammer,
  History,
  Medal,
  PawPrint,
  Plus,
  Sparkles,
  SquarePen,
  Trophy,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { normalizeTag } from "@/lib/tags";
import { fetchPlayerProfileSupabase } from "@/lib/player-profile-supabase";
import type { SupabasePlayerProfilePayload } from "@/types/player-profile-supabase";
import { useLeadership } from "@/hooks/useLeadership";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { cfg } from "@/lib/config";
import { showToast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import { Modal } from "@/components/ui/Modal";
import { LeagueBadge, TownHallBadge } from "@/components/ui";
import TrophyChart from "@/components/player/TrophyChart";
import DonationChart from "@/components/player/DonationChart";
import { HERO_MAX_LEVELS, EQUIPMENT_MAX_LEVELS } from "@/types";
import { HeroLevel } from "@/components/ui";
import { getRoleBadgeVariant } from "@/lib/leadership";
import Image from "next/image";

const DashboardLayout = dynamic(() => import("@/components/layout/DashboardLayout"), {
  ssr: false,
});

type TabKey = "overview" | "history" | "evaluations" | "metrics";

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
    | "war";
}

interface PlayerProfileClientProps {
  tag: string;
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
    case "capital_activity": {
      const total = point.capitalContributions != null ? formatNumber(point.capitalContributions) : null;
      fallback.push(total ? `Capital contributions now ${total}` : "Capital contribution recorded");
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
  capital_activity: { title: "Capital contribution", icon: "capital", tone: "positive" },
  donations_threshold: { title: "Donation milestone", icon: "donation", tone: "positive" },
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

    standardDeltaOrder.forEach((key) => {
      const delta = enrichedDeltas[key];
      if (delta === undefined) return;
      const summary = formatStandardDelta(key, delta);
      if (summary) {
        appendDescription(key, summary);
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

export default function PlayerProfileClient({ tag }: PlayerProfileClientProps) {
  const router = useRouter();
  const normalizedTag = useMemo(() => normalizeTag(tag), [tag]);
  const plainTag = normalizedTag.replace("#", "");

  const { permissions } = useLeadership();
  const canViewLeadership = permissions.canViewLeadershipFeatures;

  const currentUserEmail = useDashboardStore((state) => state.currentUser?.email ?? null);
  const fallbackClanTag = useDashboardStore(
    (state) => state.clanTag || state.homeClan || cfg.homeClanTag || null,
  );

  const [profile, setProfile] = useState<SupabasePlayerProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningText, setWarningText] = useState("");
  const [warningSaving, setWarningSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!normalizedTag) return;
    try {
      const data = await fetchPlayerProfileSupabase(normalizedTag);
      setProfile(data);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load player profile. Please try again.";
      setError(message);
      throw err;
    }
  }, [normalizedTag]);

  useEffect(() => {
    let cancelled = false;
    if (!normalizedTag) {
      setProfile(null);
      setLoading(false);
      setError("Invalid player tag");
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    loadProfile()
      .catch(() => {
        /* handled earlier */
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedTag, loadProfile]);

  const summary = profile?.summary ?? null;
  const history = profile?.history ?? null;
  const activeWarning = canViewLeadership
    ? profile?.leadership.warnings.find((warning) => warning.isActive) ?? null
    : null;
  const latestNote = canViewLeadership ? profile?.leadership.notes[0] ?? null : null;

  const donationSeries = useMemo(() => deriveDonationSeries(profile), [profile]);
  const kudosSuggestion = useMemo(() => deriveKudos(profile), [profile]);
  const timelineItems = useMemo(
    () => buildTimeline(profile, canViewLeadership),
    [profile, canViewLeadership],
  );

  const heroCaps = useMemo(() => {
    if (!summary?.townHallLevel) return null;
    return HERO_MAX_LEVELS[summary.townHallLevel] ?? null;
  }, [summary?.townHallLevel]);

  const heroLevels = summary?.heroLevels && typeof summary.heroLevels === "object"
    ? summary.heroLevels
    : {};

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
    return Object.entries(summary.equipmentLevels).sort(
      (a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0),
    );
  }, [summary?.equipmentLevels]);

  const superTroopList = summary?.superTroopsActive ?? [];
  const achievementSummary = summary?.achievements ?? { count: null, score: null };

  const handleCopySummary = useCallback(() => {
    if (!summary) return;
    const lines = [
      `${summary.name ?? "Unknown"} (${summary.tag})`,
      summary.clanName ? `Clan: ${summary.clanName}` : null,
      summary.role ? `Role: ${summary.role}` : null,
      summary.townHallLevel ? `Town Hall ${summary.townHallLevel}` : null,
      summary.seasonTotalTrophies != null
        ? `Season total trophies: ${formatNumber(summary.seasonTotalTrophies)}`
        : null,
      summary.lastWeekTrophies != null
        ? `Last Monday checkpoint: ${formatNumber(summary.lastWeekTrophies)}`
        : null,
      summary.donations?.given != null
        ? `Donations: ${formatNumber(summary.donations.given)} given, ${formatNumber(summary.donations.received)} received`
        : null,
      summary.war?.stars != null ? `War stars: ${formatNumber(summary.war.stars)}` : null,
      summary.capitalContributions != null
        ? `Capital gold: ${formatNumber(summary.capitalContributions)}`
        : null,
      summary.rushPercent != null ? `Rush score: ${formatPercent(summary.rushPercent)}` : null,
      summary.activityScore != null ? `Activity score: ${summary.activityScore.toFixed(1)}` : null,
      history?.currentStint?.startDate
        ? `Current stint since ${formatDate(history.currentStint.startDate)}`
        : null,
    ].filter(Boolean);

    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => showToast("Copied leadership summary", "success"))
      .catch(() => showToast("Unable to copy summary — copy manually instead", "error"));
  }, [summary, history]);

  const handleOpenInClash = useCallback(() => {
    if (!plainTag) return;
    const href = `https://link.clashofclans.com/?playerTag=${encodeURIComponent(plainTag)}`;
    window.open(href, "_blank", "noopener");
  }, [plainTag]);

  const clanTagForActions = summary?.clanTag ?? fallbackClanTag ?? null;

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


  const aliasList = history?.aliases ?? [];

  const renderLoading = () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-slate-300">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
        <p>Loading player profile…</p>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-3xl border border-red-500/40 bg-red-500/10 px-8 py-6 text-center text-red-100 shadow-lg">
        <p className="font-semibold">We hit a snag loading this profile.</p>
        <p className="mt-2 text-sm text-red-200/80">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={handleGoBack}>
            Back
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setLoading(true);
              loadProfile()
                .catch(() => {
                  /* handled */
                })
                .finally(() => setLoading(false));
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout clanName={summary?.clanName ?? undefined}>
      <div className="min-h-screen bg-slate-950/95 pb-20">
        <div className="w-full px-4 pb-16 pt-10">
          <div className="mb-6 flex items-center gap-3 text-sm text-slate-400">
            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-800/50 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300 transition hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300">Player Profile</span>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {(["overview", "history", "evaluations", "metrics"] as TabKey[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold capitalize transition ${
                  activeTab === tab
                    ? "border-indigo-400 bg-indigo-500/30 text-indigo-200 shadow-[0_12px_30px_-20px_rgba(99,102,241,0.9)]"
                    : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-slate-100"
                }`}
              >
                {tab === "overview" && <BarChart3 className="h-4 w-4" />}
                {tab === "history" && <History className="h-4 w-4" />}
                {tab === "evaluations" && <SquarePen className="h-4 w-4" />}
                {tab === "metrics" && <Activity className="h-4 w-4" />}
                {tab}
              </button>
            ))}
          </div>

          <div className="relative mb-10 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-900/80 to-slate-900 p-8 shadow-[0_40px_120px_-50px_rgba(79,70,229,0.6)]">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.25),transparent_55%)]" />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-1 flex-col gap-6">
                <div className="flex flex-col gap-5">
                  <div>
                    <h1 className="font-black text-3xl text-white md:text-4xl tracking-wider drop-shadow-2xl" style={{ fontFamily: "'Clash Display', sans-serif", fontWeight: '700', letterSpacing: '0.05em' }}>
                      {loading ? "Loading player..." : (summary?.name ?? "Unknown Player")}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-300/80">
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.32em] text-slate-200">
                        {normalizedTag || "No Tag"}
                      </span>
                      {summary?.role && (
                        <span>{getRoleBadgeVariant(summary.role).label}</span>
                      )}
                      {history?.status && <span>• {history.status.toUpperCase()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center">
                      {summary?.townHallLevel ? (
                        <TownHallBadge 
                          level={summary.townHallLevel} 
                          size="lg"
                          levelBadgeClassName="absolute -bottom-1 -right-1 text-sm font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                        />
                      ) : (
                        <span className="text-slate-300">TH?</span>
                      )}
                    </div>
                    {(summary?.rankedLeague?.name || summary?.league?.name) && (
                      <div className="hidden sm:block">
                        <LeagueBadge
                          league={summary?.rankedLeague?.name ?? summary?.league?.name ?? undefined}
                          trophies={summary?.rankedTrophies ?? summary?.league?.trophies ?? undefined}
                          size="lg"
                          showText={false}
                        />
                      </div>
                    )}
                  </div>
                </div>

              </div>

              <div className="flex flex-col items-stretch gap-3 max-w-xs">
                <Button
                  variant="outline"
                  className="justify-center gap-2 text-slate-100"
                  onClick={handleCopySummary}
                >
                  <Clipboard className="h-4 w-4" />
                  Copy Summary
                </Button>
                <Button
                  variant="ghost"
                  className="justify-center gap-2 border border-white/10 text-white hover:bg-white/20"
                  onClick={handleOpenInClash}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Clash
                </Button>
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
                          <div>
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
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Ranked Trophies
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.rankedTrophies != null
                                ? formatNumber(summary.rankedTrophies)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Best Trophies
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.bestTrophies != null
                                ? formatNumber(summary.bestTrophies)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Season Total
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.seasonTotalTrophies != null
                                ? formatNumber(summary.seasonTotalTrophies)
                                : "—"}
                            </p>
                            {summary?.lastWeekTrophies != null && (
                              <p className="text-xs text-slate-400">
                                Last Monday {formatNumber(summary.lastWeekTrophies)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Seasonal Donations
                            </p>
                            <p className="mt-2 text-lg font-semibold text-emerald-300">
                              {summary?.donations?.given != null
                                ? formatNumber(summary.donations.given)
                                : "—"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {summary?.donations?.received != null
                                ? `${formatNumber(summary.donations.received)} received`
                                : "Donation intake not tracked"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Capital Gold
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.capitalContributions != null
                                ? formatNumber(summary.capitalContributions)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Rush Score
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.rushPercent != null
                                ? formatPercent(summary.rushPercent)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Activity Score
                            </p>
                            <p className="mt-2 text-lg font-semibold text-indigo-200">
                              {summary?.activityScore != null
                                ? summary.activityScore.toFixed(1)
                                : "Awaiting data"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {summary?.lastSeen
                                ? `Last seen ${formatRelative(summary.lastSeen) ?? ""}`
                                : "Last seen not captured"}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Builder Hall Level
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.builderBase?.hallLevel != null
                                ? `BH ${formatNumber(summary.builderBase.hallLevel)}`
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Versus Trophies
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.builderBase?.trophies != null
                                ? formatNumber(summary.builderBase.trophies)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Versus Battle Wins
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.builderBase?.battleWins != null
                                ? formatNumber(summary.builderBase.battleWins)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Tenure
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-100">
                              {summary?.tenureDays != null
                                ? `${formatNumber(summary.tenureDays)} days`
                                : "—"}
                            </p>
                            {history?.currentStint?.startDate && (
                              <p className="text-xs text-slate-400">
                                Since {formatDate(history.currentStint.startDate)}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                              Clan Alias
                            </p>
                            <p className="mt-2 text-sm text-slate-200">
                              {aliasList.length
                                ? aliasList.slice(0, 2).map((alias) => alias.name).join(", ")
                                : "No alternate names recorded"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </GlassCard>

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
                                  clanAverage={clanHeroAverages[key]}
                                  clanAverageCount={Object.keys(clanHeroAverages).length > 0 ? Math.max(...Object.values(clanHeroAverages).map(() => 1)) : 0}
                                  clanAverageSource="profile"
                                />
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
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4">
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
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4">
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
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4">
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
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4">
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
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4">
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
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4">
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
                      >
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {equipmentEntries.map(([equipment, level]) => (
                            <div
                              key={equipment}
                              className="flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-100"
                            >
                              <span>{equipment}</span>
                              <span 
                                className="font-semibold cursor-help" 
                                title={`Level ${formatNumber(level)} of ${EQUIPMENT_MAX_LEVELS[equipment] || '?'}`}
                              >
                                {formatNumber(level)}
                              </span>
                            </div>
                          ))}
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
                        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                            War opt-in
                          </p>
                          <p className="mt-2 text-base font-semibold text-slate-100">
                            Not yet tracked
                          </p>
                          <p className="text-xs text-slate-400">
                            War preference ingestion lands in the next pipeline refresh.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                            Join status
                          </p>
                          <p className="mt-2 text-base font-semibold text-slate-100">
                            {history?.status ? history.status.toUpperCase() : "Unknown"}
                          </p>
                          {history?.currentStint?.startDate ? (
                            <p className="text-xs text-slate-400">
                              Current stint started {formatRelative(history.currentStint.startDate)}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400">
                              No active stint start recorded
                            </p>
                          )}
                        </div>
                        {canViewLeadership && (
                          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-4 md:col-span-2">
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
                                <p className="text-sm font-semibold">Active warning on file</p>
                                <p className="mt-1 text-xs text-amber-100/80">
                                  {activeWarning.warningNote}
                                </p>
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

              {activeTab === "metrics" && (
                <div className="space-y-6">
                  <GlassCard
                    title="Trophy & Donation Trends"
                    subtitle="Ranked season snapshots via nightly ingestion"
                    icon={<BarChart3 className="h-5 w-5" />}
                    className="bg-slate-900/70 border border-slate-800/80"
                  >
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <TrophyChart data={profile?.timeline?.filter(point => point.snapshotDate).map(point => ({
                        date: point.snapshotDate!,
                        trophies: point.trophies,
                        rankedTrophies: point.rankedTrophies
                      })) ?? []} />
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
                      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 px-4 py-4">
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
                      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 px-4 py-4">
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
                      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 px-4 py-4">
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

    </DashboardLayout>
  );
}
