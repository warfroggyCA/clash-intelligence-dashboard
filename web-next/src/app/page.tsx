/**
 * Clash Intelligence Dashboard - Main Dashboard
 * 
 * A comprehensive Clash of Clans clan management dashboard featuring:
 * - Live roster data from CoC API with rate limiting
 * - Hero level tracking with TH-appropriate max levels
 * - Rush percentage calculation (peer-relative)
 * - Donation balance tracking (shows deficit when receiving more than giving)
 * - Tenure tracking with append-only ledger
 * - Player notes and custom fields
 * - AI-powered coaching and summaries
 * - Snapshot versioning for historical data
 * - Modern UI with gradients and responsive design
 * 
 * Version: 0.6
 * Last Updated: January 2025
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, X } from "lucide-react";
import { cfg } from "../lib/config";
import ChangeDashboard from "../components/ChangeDashboard";
import DepartureManager from "../components/DepartureManager";
import CreatePlayerNoteModal from "../components/CreatePlayerNoteModal";
import PlayerDatabase from "../components/PlayerDatabase";
import AICoaching from "../components/AICoaching";

type Member = {
  name: string; tag: string; townHallLevel?: number; th?: number;
  bk?: number; aq?: number; gw?: number; rc?: number; mp?: number;
  trophies?: number; donations?: number; donationsReceived?: number; warStars?: number;
  tenure_days?: number; tenure?: number; lastSeen?: string | number; role?: string; recentClans?: string[];
};

// Event tracking types
type PlayerEvent = {
  id: string;
  playerTag: string;
  playerName: string;
  eventType: 'th_upgrade' | 'role_change' | 'trophy_milestone' | 'hero_upgrade' | 'donation_milestone' | 'name_change' | 'joined_clan' | 'left_clan';
  eventData: {
    from?: any;
    to?: any;
    milestone?: string;
    details?: string;
  };
  timestamp: string;
  clanTag: string;
};

type EventHistory = Record<string, PlayerEvent[]>; // playerTag -> events[]
type Roster = { source: "live" | "fallback" | "snapshot"; date?: string; clanName?: string; members: Member[]; meta?: any };

type SortKey = "name"|"tag"|"th"|"bk"|"aq"|"gw"|"rc"|"mp"|"rush"|"trophies"|"donations"|"donationsReceived"|"tenure"|"activity"|"role";
const DEFAULT_PAGE_SIZE = 100;

const HEAD_TIPS: Record<string,string> = {
  Name:"Player name", Tag:"Player tag", TH:"Town Hall level",
  BK:"Barbarian King", AQ:"Archer Queen", GW:"Grand Warden", RC:"Royal Champion", MP:"Minion Prince",
  "Rush %":"Deficit vs best heroes at same TH in your roster (0% = green / not rushed, 100% = red / very rushed)",
  Trophies:"Trophy count", 
  Don:"Donations given (red number below shows deficit if receiving more than giving)", 
  Recv:"Donations received",
  "Tenure (d)":"Days in clan (append-only ledger)",
  "Last Activity":"Time since last significant gameplay activity (* = estimated from donations, will improve with snapshot history)", Role:"Clan role"
};

const HERO_MIN_TH: Record<"bk"|"aq"|"gw"|"rc"|"mp", number> = { bk:7, aq:9, gw:11, rc:13, mp:9 };

// Max hero levels for each Town Hall (updated 2024)
const HERO_MAX_LEVELS: Record<number, Record<"bk"|"aq"|"gw"|"rc"|"mp", number>> = {
  7: { bk: 10, aq: 0, gw: 0, rc: 0, mp: 0 },
  8: { bk: 20, aq: 0, gw: 0, rc: 0, mp: 0 },
  9: { bk: 30, aq: 30, gw: 0, rc: 0, mp: 30 },
  10: { bk: 40, aq: 40, gw: 0, rc: 0, mp: 40 },
  11: { bk: 50, aq: 50, gw: 20, rc: 0, mp: 50 },
  12: { bk: 65, aq: 65, gw: 40, rc: 0, mp: 65 },
  13: { bk: 75, aq: 75, gw: 50, rc: 25, mp: 75 },
  14: { bk: 80, aq: 80, gw: 65, rc: 40, mp: 80 },
  15: { bk: 90, aq: 90, gw: 75, rc: 50, mp: 90 },
  16: { bk: 95, aq: 95, gw: 80, rc: 65, mp: 95 },
  17: { bk: 100, aq: 100, gw: 90, rc: 75, mp: 100 }
};
const getTH = (m: Member) => m.townHallLevel ?? m.th ?? undefined;
const getTenure = (m: Member) => {
  const v = m.tenure_days ?? m.tenure;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};

/**
 * Calculates donation balance for a member
 * @param member - The clan member to analyze
 * @returns Object with given, received, balance, and isNegative flag
 * Note: isNegative=true means they receive more than they give (concerning)
 */
const getDonationBalance = (member: Member) => {
  const given = member.donations ?? 0;
  const received = member.donationsReceived ?? 0;
  const balance = received - given;
  return { given, received, balance, isNegative: balance > 0 };
};

// Activity inference system based on gameplay metrics
const calculateActivityScore = (member: Member, previousMember?: Member): {
  score: number;
  level: 'Very Active' | 'Active' | 'Moderate' | 'Low' | 'Inactive';
  indicators: string[];
  lastActivity: string;
  lastActivityDate: string;
} => {
  const indicators: string[] = [];
  let score = 0;

  // 1. Donation Activity (0-30 points)
  const donations = member.donations ?? 0;
  const donationsReceived = member.donationsReceived ?? 0;
  const totalDonationActivity = donations + donationsReceived;
  
  if (totalDonationActivity >= 1000) {
    score += 30;
    indicators.push("High donation activity");
  } else if (totalDonationActivity >= 500) {
    score += 20;
    indicators.push("Good donation activity");
  } else if (totalDonationActivity >= 100) {
    score += 10;
    indicators.push("Moderate donation activity");
  } else if (totalDonationActivity > 0) {
    score += 5;
    indicators.push("Low donation activity");
  }

  // 2. Trophy Activity (0-25 points)
  const trophies = member.trophies ?? 0;
  const previousTrophies = previousMember?.trophies ?? trophies;
  const trophyChange = trophies - previousTrophies;
  
  if (trophyChange > 100) {
    score += 25;
    indicators.push("Significant trophy gain");
  } else if (trophyChange > 50) {
    score += 15;
    indicators.push("Good trophy progress");
  } else if (trophyChange > 0) {
    score += 10;
    indicators.push("Trophy gain");
  } else if (trophyChange >= -50) {
    score += 5;
    indicators.push("Stable trophy count");
  }

  // 3. Town Hall Progress (0-20 points)
  const th = member.townHallLevel ?? 0;
  const previousTh = previousMember?.townHallLevel ?? th;
  
  if (th > previousTh) {
    score += 20;
    indicators.push("Town Hall upgrade");
  } else if (th >= 12) {
    score += 10;
    indicators.push("High TH level");
  } else if (th >= 8) {
    score += 5;
    indicators.push("Mid TH level");
  }

  // 4. Hero Activity (0-15 points)
  const heroes = [
    member.bk ?? 0,
    member.aq ?? 0,
    member.gw ?? 0,
    member.rc ?? 0,
    member.mp ?? 0
  ];
  const previousHeroes = [
    previousMember?.bk ?? 0,
    previousMember?.aq ?? 0,
    previousMember?.gw ?? 0,
    previousMember?.rc ?? 0,
    previousMember?.mp ?? 0
  ];
  
  const heroUpgrades = heroes.reduce((count, current, index) => {
    return count + (current > previousHeroes[index] ? 1 : 0);
  }, 0);
  
  if (heroUpgrades > 0) {
    score += 15;
    indicators.push(`${heroUpgrades} hero upgrade${heroUpgrades > 1 ? 's' : ''}`);
  } else if (heroes.some(level => level > 0)) {
    score += 5;
    indicators.push("Heroes present");
  }

  // 5. Clan Role Activity (0-10 points)
  const role = member.role?.toLowerCase() ?? '';
  if (role === 'leader' || role === 'co-leader') {
    score += 10;
    indicators.push("Leadership role");
  } else if (role === 'elder') {
    score += 5;
    indicators.push("Elder role");
  }

  // 6. Recent Activity Bonus (0-10 points)
  // If we have previous data, check for any changes
  if (previousMember) {
    const hasChanges = 
      member.trophies !== previousMember.trophies ||
      member.donations !== previousMember.donations ||
      member.donationsReceived !== previousMember.donationsReceived ||
      member.townHallLevel !== previousMember.townHallLevel ||
      JSON.stringify(heroes) !== JSON.stringify(previousHeroes);
    
    if (hasChanges) {
      score += 10;
      indicators.push("Recent activity detected");
    }
  } else {
    // No previous data - use current activity levels to infer recency
    // High donation activity suggests very recent activity
    if (totalDonationActivity >= 100) {
      score += 10;
      indicators.push("High recent donation activity");
    } else if (totalDonationActivity >= 50) {
      score += 8;
      indicators.push("Good recent donation activity");
    } else if (totalDonationActivity > 0) {
      score += 5;
      indicators.push("Some recent donation activity");
    } else {
      // No donation activity - could be inactive or very new
      score += 2;
      indicators.push("Limited recent activity");
    }
  }

  // Determine activity level
  let level: 'Very Active' | 'Active' | 'Moderate' | 'Low' | 'Inactive';
  if (score >= 70) level = 'Very Active';
  else if (score >= 50) level = 'Active';
  else if (score >= 30) level = 'Moderate';
  else if (score >= 15) level = 'Low';
  else level = 'Inactive';

  // Generate last activity description and date
  let lastActivity = "Unknown";
  let lastActivityDate = "Unknown";
  
  if (indicators.length > 0) {
    const recentIndicators = indicators.filter(ind => 
      ind.includes("upgrade") || 
      ind.includes("gain") || 
      ind.includes("Recent activity")
    );
    if (recentIndicators.length > 0) {
      lastActivity = recentIndicators[0];
    } else {
      lastActivity = indicators[0];
    }
    
    // For last activity date, use donation activity as a proxy for recency
    // High donation activity suggests very recent activity (donations reset monthly)
    if (totalDonationActivity >= 1000) {
      lastActivityDate = "Today";
    } else if (totalDonationActivity >= 500) {
      lastActivityDate = "1-2 days";
    } else if (totalDonationActivity >= 200) {
      lastActivityDate = "3-5 days";
    } else if (totalDonationActivity >= 100) {
      lastActivityDate = "1 week";
    } else if (totalDonationActivity >= 50) {
      lastActivityDate = "1-2 weeks";
    } else if (totalDonationActivity > 0) {
      lastActivityDate = "2-3 weeks";
    } else {
      // No donation activity - use overall score
      if (score >= 50) {
        lastActivityDate = "1-2 weeks";
      } else if (score >= 30) {
        lastActivityDate = "2-4 weeks";
      } else {
        lastActivityDate = "1+ months";
      }
    }
  }

  return { score, level, indicators, lastActivity, lastActivityDate };
};

// Applicant evaluation system
const evaluateApplicant = (applicant: Member, currentRoster: Member[]): {
  score: number;
  breakdown: Array<{category: string, points: number, maxPoints: number, details: string}>;
  recommendation: 'Excellent' | 'Good' | 'Fair' | 'Poor';
} => {
  const breakdown: Array<{category: string, points: number, maxPoints: number, details: string}> = [];
  let totalScore = 0;
  let maxTotalScore = 0;

  // 1. Town Hall Level (0-25 points)
  const th = applicant.townHallLevel ?? 0;
  let thScore = 0;
  let thDetails = "";
  if (th >= 15) {
    thScore = 25;
    thDetails = "TH15+ - High level player";
  } else if (th >= 13) {
    thScore = 20;
    thDetails = "TH13-14 - Strong player";
  } else if (th >= 11) {
    thScore = 15;
    thDetails = "TH11-12 - Good level";
  } else if (th >= 9) {
    thScore = 10;
    thDetails = "TH9-10 - Decent level";
  } else {
    thScore = 5;
    thDetails = "TH8 or below - Lower level";
  }
  breakdown.push({ category: "Town Hall Level", points: thScore, maxPoints: 25, details: thDetails });
  totalScore += thScore;
  maxTotalScore += 25;

  // 2. Hero Development (0-30 points)
  const heroes = [
    applicant.bk ?? 0,
    applicant.aq ?? 0,
    applicant.gw ?? 0,
    applicant.rc ?? 0,
    applicant.mp ?? 0
  ];
  const maxHeroes = HERO_MAX_LEVELS[th] || { bk: 0, aq: 0, gw: 0, rc: 0, mp: 0 };
  const heroValues = [maxHeroes.bk, maxHeroes.aq, maxHeroes.gw, maxHeroes.rc, maxHeroes.mp];
  
  let heroScore = 0;
  let heroDetails = "";
  const heroProgress = heroes.map((level, idx) => {
    const max = heroValues[idx];
    return max > 0 ? (level / max) * 100 : 0;
  });
  
  const avgHeroProgress = heroProgress.reduce((sum, p) => sum + p, 0) / heroProgress.filter(p => p > 0).length || 0;
  
  if (avgHeroProgress >= 80) {
    heroScore = 30;
    heroDetails = "Excellent hero development (80%+)";
  } else if (avgHeroProgress >= 60) {
    heroScore = 25;
    heroDetails = "Good hero development (60-79%)";
  } else if (avgHeroProgress >= 40) {
    heroScore = 15;
    heroDetails = "Moderate hero development (40-59%)";
  } else if (avgHeroProgress > 0) {
    heroScore = 10;
    heroDetails = "Poor hero development (<40%)";
  } else {
    heroScore = 0;
    heroDetails = "No heroes developed";
  }
  breakdown.push({ category: "Hero Development", points: heroScore, maxPoints: 30, details: heroDetails });
  totalScore += heroScore;
  maxTotalScore += 30;

  // 3. Trophy Count (0-20 points)
  const trophies = applicant.trophies ?? 0;
  let trophyScore = 0;
  let trophyDetails = "";
  if (trophies >= 5000) {
    trophyScore = 20;
    trophyDetails = "5000+ trophies - Elite player";
  } else if (trophies >= 4000) {
    trophyScore = 15;
    trophyDetails = "4000+ trophies - Strong player";
  } else if (trophies >= 3000) {
    trophyScore = 10;
    trophyDetails = "3000+ trophies - Good player";
  } else if (trophies >= 2000) {
    trophyScore = 5;
    trophyDetails = "2000+ trophies - Average player";
  } else {
    trophyScore = 0;
    trophyDetails = "Under 2000 trophies - Low activity";
  }
  breakdown.push({ category: "Trophy Count", points: trophyScore, maxPoints: 20, details: trophyDetails });
  totalScore += trophyScore;
  maxTotalScore += 20;

  // 4. Clan Fit (0-15 points) - Compare with current roster
  const currentThs = currentRoster.map(m => m.townHallLevel ?? 0).filter(th => th > 0);
  const avgTh = currentThs.length > 0 ? currentThs.reduce((sum, t) => sum + t, 0) / currentThs.length : 0;
  const thDiff = Math.abs(th - avgTh);
  
  let fitScore = 0;
  let fitDetails = "";
  if (thDiff <= 1) {
    fitScore = 15;
    fitDetails = `Perfect fit - TH${th} matches clan average (TH${avgTh.toFixed(1)})`;
  } else if (thDiff <= 2) {
    fitScore = 10;
    fitDetails = `Good fit - TH${th} close to clan average (TH${avgTh.toFixed(1)})`;
  } else if (thDiff <= 3) {
    fitScore = 5;
    fitDetails = `Fair fit - TH${th} differs from clan average (TH${avgTh.toFixed(1)})`;
  } else {
    fitScore = 0;
    fitDetails = `Poor fit - TH${th} very different from clan average (TH${avgTh.toFixed(1)})`;
  }
  breakdown.push({ category: "Clan Fit", points: fitScore, maxPoints: 15, details: fitDetails });
  totalScore += fitScore;
  maxTotalScore += 15;

  // 5. Activity Indicators (0-10 points)
  const donations = applicant.donations ?? 0;
  const donationsReceived = applicant.donationsReceived ?? 0;
  const totalDonations = donations + donationsReceived;
  
  let activityScore = 0;
  let activityDetails = "";
  if (totalDonations >= 500) {
    activityScore = 10;
    activityDetails = "Very active - High donation activity";
  } else if (totalDonations >= 200) {
    activityScore = 7;
    activityDetails = "Active - Good donation activity";
  } else if (totalDonations >= 50) {
    activityScore = 4;
    activityDetails = "Moderate - Some donation activity";
  } else {
    activityScore = 0;
    activityDetails = "Low activity - Minimal donations";
  }
  breakdown.push({ category: "Activity Level", points: activityScore, maxPoints: 10, details: activityDetails });
  totalScore += activityScore;
  maxTotalScore += 10;

  // Calculate recommendation
  const percentage = (totalScore / maxTotalScore) * 100;
  let recommendation: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  if (percentage >= 80) {
    recommendation = 'Excellent';
  } else if (percentage >= 60) {
    recommendation = 'Good';
  } else if (percentage >= 40) {
    recommendation = 'Fair';
  } else {
    recommendation = 'Poor';
  }

  return {
    score: Math.round(percentage),
    breakdown,
    recommendation
  };
};

// Convert API role names to proper Clash of Clans role names
const formatRole = (role?: string): string => {
  if (!role) return "Member";
  
  // CoC API actually sends these exact values:
  const roleMap: Record<string, string> = {
    "leader": "Leader",
    "coLeader": "Co-Leader", 
    "elder": "Elder",
    "member": "Member",
    "admin": "Elder", // CoC API uses "admin" for Elder role
  };
  
  const normalizedRole = role.toLowerCase();
  return roleMap[normalizedRole] || role; // Return original if not found for debugging
};

// Enhanced role display with colors and icons
const renderRole = (role?: string) => {
  const formattedRole = formatRole(role);
  
  const roleConfig = {
    "Leader": { 
      color: "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white", 
      icon: "👑", 
      textColor: "text-white" 
    },
    "Co-Leader": { 
      color: "bg-gradient-to-r from-purple-500 to-purple-600 text-white", 
      icon: "💎", 
      textColor: "text-white" 
    },
    "Elder": { 
      color: "bg-gradient-to-r from-blue-500 to-blue-600 text-white", 
      icon: "⭐", 
      textColor: "text-white" 
    },
    "Member": { 
      color: "bg-gray-100 text-gray-600 border border-gray-200", 
      icon: "", 
      textColor: "text-gray-600" 
    }
  };
  
  const config = roleConfig[formattedRole] || roleConfig["Member"];
  
  return (
    <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold ${config.color} shadow-sm`}>
      <span>{config.icon}</span>
      <span>{formattedRole}</span>
    </span>
  );
};

// Check if a player has changed their name
const hasNameChanged = (member: Member, nameHistory: Record<string, Array<{name: string, timestamp: string}>>): boolean => {
  const tag = member.tag.toUpperCase();
  const history = nameHistory[tag];
  return history && history.length > 1;
};

// Get previous name for a player
const getPreviousName = (member: Member, nameHistory: Record<string, Array<{name: string, timestamp: string}>>): string | null => {
  const tag = member.tag.toUpperCase();
  const history = nameHistory[tag];
  if (history && history.length > 1) {
    return history[history.length - 2].name;
  }
  return null;
};
const cmp = (a: any, b: any) => {
  const an = typeof a === "number", bn = typeof b === "number";
  return (an && bn) ? (a-b) : String(a ?? "").localeCompare(String(b ?? ""), undefined, {sensitivity:"base"});
};

// Hero caps calculation (moved outside component for reuse)
type Caps = Partial<Record<"bk"|"aq"|"gw"|"rc"|"mp", number>>;

const calculateThCaps = (members: Member[]): Map<number, Caps> => {
  const caps = new Map<number, Caps>();
  for (const m of members) {
    const th = getTH(m); 
    if (!th) continue;
    const c = caps.get(th) || {};
    for (const k of ["bk","aq","gw","rc","mp"] as const) {
      const v = (m as any)[k];
      if (typeof v === "number" && v > 0) c[k] = Math.max(c[k] || 0, v);
    }
    caps.set(th, c);
  }
  return caps;
};

// Rush percentage calculation (moved outside component for reuse)
const rushPercent = (m: Member, thCaps?: Map<number, Caps>): number => {
  const th = getTH(m) ?? 0; 
  const caps = thCaps?.get(th) || {};
  const keys: ("bk"|"aq"|"gw"|"rc"|"mp")[] = []; 
  if (th>=7) keys.push("bk"); 
  if (th>=9) { keys.push("aq","mp"); } 
  if (th>=11) keys.push("gw"); 
  if (th>=13) keys.push("rc");
  let sum = 0, cnt = 0;
  for (const k of keys) {
    const cap = (caps as any)[k] as number|undefined; 
    if (!cap || cap <= 0) continue;
    const raw = (m as any)[k]; 
    const v = typeof raw === "number" ? raw : (raw != null && !Number.isNaN(Number(raw)) ? Number(raw) : 0);
    sum += Math.max(0, Math.min(1, v / cap)); 
    cnt++;
  }
  if (!cnt) return 0;
  return Math.round((1 - (sum/cnt)) * 100);
};

function getHeroProgressColor(percentage: number): string {
  if (percentage >= 80) return "text-green-700 font-semibold"; // 80%+ = excellent
  if (percentage >= 60) return "text-green-700"; // 60-79% = good
  if (percentage >= 40) return "text-yellow-600"; // 40-59% = moderate
  if (percentage >= 20) return "text-orange-600"; // 20-39% = needs work
  return "text-red-600 font-semibold"; // <20% = poor
}

function renderHeroCell(m: Member, key: "bk"|"aq"|"gw"|"rc"|"mp"){
  const th = getTH(m) ?? 0; const req = HERO_MIN_TH[key];
  const raw = (m as any)[key];
  const v = typeof raw === "number" ? raw : (raw != null && !Number.isNaN(Number(raw)) ? Number(raw) : undefined);
  
  if (th < req) {
    const title = key==="bk"?"BK unlocks at TH7":key==="aq"?"AQ unlocks at TH9":key==="gw"?"GW unlocks at TH11":key==="rc"?"RC unlocks at TH13":"MP unlocks at TH9 (Hero Hall)";
    return <span className="cursor-help hover:underline hover:decoration-dotted hover:underline-offset-2 text-gray-400" title={title}>—</span>;
  }
  
  if (v == null || v <= 0) {
    const maxLevel = HERO_MAX_LEVELS[th]?.[key] || 0;
    const title = maxLevel > 0 ? `Eligible but not started\nMax level for TH${th}: ${maxLevel}` : "Eligible but not started";
    return <span className="inline-flex items-center justify-center cursor-help hover:font-medium text-red-500 font-semibold" title={title}><AlertCircle className="w-4 h-4" /></span>;
  }
  
  // Hero has a level - show tooltip with max level and completion percentage
  const maxLevel = HERO_MAX_LEVELS[th]?.[key] || 0;
  if (maxLevel > 0) {
    const percentage = Math.round((v / maxLevel) * 100);
    const title = `Level ${v} / ${maxLevel} (${percentage}%)\nMax level for TH${th}`;
    const colorClass = getHeroProgressColor(percentage);
    return <span className={`cursor-help hover:underline hover:decoration-dotted hover:underline-offset-2 ${colorClass}`} title={title}>{v}</span>;
  }
  
  return v;
}

export default function HomePage(){
  const [roster, setRoster] = useState<Roster | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");

  // clan tag UX
  const fromCfg = (cfg.homeClanTag || "").toUpperCase();
  const [clanTag, setClanTag] = useState<string>("");
  const [homeClan, setHomeClan] = useState<string | null>(null);

  // table UX
  const [sortKey, setSortKey] = useState<SortKey>("trophies");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [recentClanFilter, setRecentClanFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"roster" | "changes" | "database" | "coaching" | "events" | "applicants">("roster");
  const [showDepartureManager, setShowDepartureManager] = useState(false);
  const [departureNotifications, setDepartureNotifications] = useState(0);
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showPlayerProfile, setShowPlayerProfile] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Member | null>(null);
  const [availableSnapshots, setAvailableSnapshots] = useState<Array<{date: string, memberCount: number}>>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("latest");
  const [showCreatePlayerNote, setShowCreatePlayerNote] = useState(false);
  const [playerNameHistory, setPlayerNameHistory] = useState<Record<string, Array<{name: string, timestamp: string}>>>({});
  const [eventHistory, setEventHistory] = useState<EventHistory>({});
  const [eventFilterPlayer, setEventFilterPlayer] = useState<string>("all");
  
  // Applicant evaluation state
  const [applicantTag, setApplicantTag] = useState<string>("");
  const [applicantData, setApplicantData] = useState<Member | null>(null);
  const [applicantLoading, setApplicantLoading] = useState(false);
  const [applicantError, setApplicantError] = useState<string>("");
  const [applicantFitScore, setApplicantFitScore] = useState<{
    score: number;
    breakdown: Array<{category: string, points: number, maxPoints: number, details: string}>;
    recommendation: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  } | null>(null);

  // On first load: prefer saved home tag; else cfg; then empty.
  useEffect(() => {
    const saved = (typeof window !== "undefined" && window.localStorage.getItem("homeClanTag")) || "";
    const initial = (saved || fromCfg || "").toUpperCase();
    setClanTag(initial);
    if (initial) {
      // Set home clan and auto-load stored snapshot data
      setHomeClan(initial);
      loadAvailableSnapshots(initial);
      loadStoredData(initial).catch(()=>{});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSetHome = () => {
    const v = (clanTag || "").trim().toUpperCase();
    if (!v) { setHomeClan(null); setMessage("Home clan cleared."); return; }
    try {
      window.localStorage.setItem("homeClanTag", v);
      setHomeClan(v);
      setMessage(`Home clan set to ${v}.`);
    } catch {
      setMessage("Failed to save home clan to local storage.");
    }
  };

  // Check for departure notifications
  const checkDepartureNotifications = async () => {
    const currentTag = clanTag || homeClan;
    if (!currentTag) return;
    
    try {
      const response = await fetch(`/api/departures/notifications?clanTag=${encodeURIComponent(currentTag)}`);
      const data = await response.json();
      
      if (data.success) {
        const totalNotifications = (data.rejoins?.length || 0) + (data.activeDepartures?.length || 0);
        setDepartureNotifications(totalNotifications);
      }
    } catch (error) {
      console.error('Failed to check departure notifications:', error);
    }
  };

  // Check notifications when clan tag changes
  useEffect(() => {
    checkDepartureNotifications();
  }, [clanTag, homeClan]);

  // Fetch applicant data from CoC API
  const fetchApplicantData = async () => {
    console.log("fetchApplicantData called with tag:", applicantTag);
    
    if (!applicantTag.trim()) {
      setApplicantError("Please enter a player tag");
      return;
    }

    setApplicantLoading(true);
    setApplicantError("");
    setApplicantData(null);
    setApplicantFitScore(null);

    try {
      let tag = applicantTag.trim();
      if (!tag.startsWith('#')) {
        tag = '#' + tag;
      }

      console.log(`Fetching player data for tag: ${tag}`);
      const encodedTag = encodeURIComponent(tag);
      console.log(`Encoded tag: ${encodedTag}`);
      const response = await fetch(`/api/player/${encodedTag}`);
      console.log(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to fetch player data: ${response.status} ${response.statusText}`);
      }

      const playerData = await response.json();
      setApplicantData(playerData);

      // Calculate fit score
      if (roster?.members) {
        const fitScore = evaluateApplicant(playerData, roster.members);
        setApplicantFitScore(fitScore);
      }

      // Add to player database as applicant
      const existingNotes = JSON.parse(localStorage.getItem('playerNotes') || '{}');
      const applicantNotes = existingNotes[tag] || [];
      const newNote = {
        note: `Applicant evaluation - ${new Date().toLocaleDateString()}`,
        timestamp: new Date().toISOString()
      };
      existingNotes[tag] = [...applicantNotes, newNote];
      localStorage.setItem('playerNotes', JSON.stringify(existingNotes));

    } catch (error: any) {
      setApplicantError(error.message || "Failed to fetch player data");
    } finally {
      setApplicantLoading(false);
    }
  };

  // Track player name changes
  const trackNameChanges = (members: Member[]) => {
    const currentTime = new Date().toISOString();
    const newHistory = { ...playerNameHistory };
    
    members.forEach(member => {
      const tag = member.tag.toUpperCase();
      const currentName = member.name;
      
      if (!newHistory[tag]) {
        // First time seeing this player
        newHistory[tag] = [{ name: currentName, timestamp: currentTime }];
      } else {
        const lastEntry = newHistory[tag][newHistory[tag].length - 1];
        if (lastEntry.name !== currentName) {
          // Name has changed
          newHistory[tag].push({ name: currentName, timestamp: currentTime });
        }
      }
    });
    
    setPlayerNameHistory(newHistory);
    
    // Save to localStorage
    localStorage.setItem('playerNameHistory', JSON.stringify(newHistory));
  };

  // Load name history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('playerNameHistory');
    if (saved) {
      setPlayerNameHistory(JSON.parse(saved));
    }
  }, []);

  // Load event history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('playerEventHistory');
    if (saved) {
      setEventHistory(JSON.parse(saved));
    }
  }, []);

  // Track name changes when roster loads
  useEffect(() => {
    if (roster?.members) {
      trackNameChanges(roster.members);
      trackPlayerEvents(roster.members);
    }
  }, [roster]);

  // Event tracking functions
  const trackPlayerEvents = (currentMembers: Member[]) => {
    const currentTime = new Date().toISOString();
    const currentClanTag = clanTag || homeClan || "";
    const newEvents: PlayerEvent[] = [];
    const updatedEventHistory = { ...eventHistory };

    currentMembers.forEach(member => {
      const tag = member.tag.toUpperCase();
      const currentTH = getTH(member);
      const currentRole = formatRole(member.role);
      const currentTrophies = member.trophies || 0;
      const currentDonations = member.donations || 0;

      // Get previous member data from last roster
      const previousMember = roster?.members?.find(m => m.tag.toUpperCase() === tag);
      
      if (previousMember) {
        const previousTH = getTH(previousMember);
        const previousRole = formatRole(previousMember.role);
        const previousTrophies = previousMember.trophies || 0;
        const previousDonations = previousMember.donations || 0;

        // Track TH upgrades
        if (currentTH && previousTH && currentTH > previousTH) {
          newEvents.push({
            id: `${tag}_th_${currentTime}`,
            playerTag: tag,
            playerName: member.name,
            eventType: 'th_upgrade',
            eventData: {
              from: previousTH,
              to: currentTH,
              details: `Upgraded from TH${previousTH} to TH${currentTH}`
            },
            timestamp: currentTime,
            clanTag: currentClanTag
          });
        }

        // Track role changes
        if (currentRole !== previousRole) {
          newEvents.push({
            id: `${tag}_role_${currentTime}`,
            playerTag: tag,
            playerName: member.name,
            eventType: 'role_change',
            eventData: {
              from: previousRole,
              to: currentRole,
              details: `Role changed from ${previousRole} to ${currentRole}`
            },
            timestamp: currentTime,
            clanTag: currentClanTag
          });
        }

        // Track trophy milestones (500+ trophy gains)
        if (currentTrophies - previousTrophies >= 500) {
          newEvents.push({
            id: `${tag}_trophy_${currentTime}`,
            playerTag: tag,
            playerName: member.name,
            eventType: 'trophy_milestone',
            eventData: {
              from: previousTrophies,
              to: currentTrophies,
              milestone: `${currentTrophies} trophies`,
              details: `Gained ${currentTrophies - previousTrophies} trophies (${previousTrophies} → ${currentTrophies})`
            },
            timestamp: currentTime,
            clanTag: currentClanTag
          });
        }

        // Track donation milestones (1000+ donation gains)
        if (currentDonations - previousDonations >= 1000) {
          newEvents.push({
            id: `${tag}_donation_${currentTime}`,
            playerTag: tag,
            playerName: member.name,
            eventType: 'donation_milestone',
            eventData: {
              from: previousDonations,
              to: currentDonations,
              milestone: `${currentDonations} donations`,
              details: `Gained ${currentDonations - previousDonations} donations (${previousDonations} → ${currentDonations})`
            },
            timestamp: currentTime,
            clanTag: currentClanTag
          });
        }

        // Track hero upgrades (5+ level gains)
        const heroKeys: Array<keyof Member> = ['bk', 'aq', 'gw', 'rc', 'mp'];
        heroKeys.forEach(hero => {
          const currentLevel = member[hero] || 0;
          const previousLevel = previousMember[hero] || 0;
          if (currentLevel - previousLevel >= 5) {
            newEvents.push({
              id: `${tag}_${hero}_${currentTime}`,
              playerTag: tag,
              playerName: member.name,
              eventType: 'hero_upgrade',
              eventData: {
                from: previousLevel,
                to: currentLevel,
                details: `${hero.toUpperCase()} upgraded from level ${previousLevel} to ${currentLevel} (+${currentLevel - previousLevel})`
              },
              timestamp: currentTime,
              clanTag: currentClanTag
            });
          }
        });
      }
    });

    // Add new events to history
    newEvents.forEach(event => {
      if (!updatedEventHistory[event.playerTag]) {
        updatedEventHistory[event.playerTag] = [];
      }
      updatedEventHistory[event.playerTag].push(event);
    });

    setEventHistory(updatedEventHistory);
    
    // Save to localStorage
    localStorage.setItem('playerEventHistory', JSON.stringify(updatedEventHistory));

    // Show notifications for significant events
    if (newEvents.length > 0) {
      const significantEvents = newEvents.filter(e => 
        e.eventType === 'th_upgrade' || 
        e.eventType === 'role_change' || 
        e.eventType === 'trophy_milestone'
      );
      
      if (significantEvents.length > 0) {
        setMessage(`🎉 ${significantEvents.length} significant event(s) detected! Check player profiles for details.`);
        setStatus("success");
      }
    }
  };

  // Load available snapshots for a clan
  const loadAvailableSnapshots = async (clanTag: string) => {
    try {
      const response = await fetch(`/api/snapshots/list?clanTag=${encodeURIComponent(clanTag)}`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableSnapshots(data.snapshots || []);
      }
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    }
  };

  // Load stored snapshot data (not live data)
  async function loadStoredData(tagParam?: string, snapshotDate?: string) {
    const raw = (tagParam ?? clanTag ?? "").trim().toUpperCase();
    if (!raw) { setMessage("Enter a clan tag (e.g., #2PR8R8V8P) and press Load."); return; }
    
    setStatus("loading"); 
    setMessage(`Loading stored data for ${raw}…`);
    
    try {
      const params = new URLSearchParams({ mode: "snapshot", clanTag: raw });
      if (snapshotDate && snapshotDate !== "latest") {
        params.set("date", snapshotDate);
      }
      
      const r = await fetch(`/api/roster?${params.toString()}`, { cache: "no-store" });
      const j = await r.json();
      
      if (!r.ok) throw new Error(j?.error || "Failed to load stored data.");
      
      setRoster(j as Roster);
      setStatus("success");
      setMessage(`Loaded ${j.members?.length ?? 0} members from stored data (${j.clanName || raw}).`);
      setPage(1);
    } catch (e:any) {
      setStatus("error");
      setMessage(e?.message || "Failed to load stored data.");
    }
  }

  // Handle manual departure recording
  const handleMarkDeparture = (member: Member) => {
    setSelectedMember(member);
    setShowDepartureModal(true);
  };

  // Handle opening player profile
  const handleOpenPlayerProfile = (member: Member) => {
    setSelectedPlayer(member);
    setShowPlayerProfile(true);
  };

  // Copy comprehensive data to clipboard for LLM analysis
  const copyToClipboard = async () => {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        clanInfo: {
          tag: clanTag || homeClan,
          name: roster?.clanName,
          source: roster?.source,
          date: roster?.date,
          memberCount: roster?.members?.length || 0
        },
        members: roster?.members?.map(member => ({
          name: member.name,
          tag: member.tag,
          townHall: getTH(member),
          role: formatRole(member.role),
          trophies: member.trophies,
          donations: member.donations,
          donationsReceived: member.donationsReceived,
          tenure: getTenure(member),
          lastSeen: member.lastSeen,
          heroes: {
            barbarianKing: member.bk,
            archerQueen: member.aq,
            grandWarden: member.gw,
            royalChampion: member.rc,
            minionPrince: member.mp
          },
          rushPercent: rushPercent(member, thCaps),
          recentClans: member.recentClans,
          events: eventHistory[member.tag.toUpperCase()] || []
        })) || [],
        summary: {
          totalMembers: roster?.members?.length || 0,
          averageTownHall: roster?.members?.length ? 
            Math.round(roster.members.reduce((sum, m) => sum + (getTH(m) || 0), 0) / roster.members.length * 10) / 10 : 0,
          averageTrophies: roster?.members?.length ? 
            Math.round(roster.members.reduce((sum, m) => sum + (m.trophies || 0), 0) / roster.members.length) : 0,
          totalDonations: roster?.members?.reduce((sum, m) => sum + (m.donations || 0), 0) || 0,
          roleDistribution: roster?.members?.reduce((acc, m) => {
            const role = formatRole(m.role);
            acc[role] = (acc[role] || 0) + 1;
            return acc;
          }, {} as Record<string, number>) || {}
        }
      };

      const formattedText = `CLASH OF CLANS CLAN ANALYSIS DATA

Clan: ${exportData.clanInfo.name} (${exportData.clanInfo.tag})
Data Source: ${exportData.clanInfo.source} - ${exportData.clanInfo.date}
Total Members: ${exportData.summary.totalMembers}

CLAN SUMMARY:
- Average Town Hall Level: ${exportData.summary.averageTownHall}
- Average Trophies: ${exportData.summary.averageTrophies}
- Total Donations: ${exportData.summary.totalDonations}
- Role Distribution: ${Object.entries(exportData.summary.roleDistribution).map(([role, count]) => `${role}: ${count}`).join(', ')}

MEMBER DETAILS:
${exportData.members.map(member => `
${member.name} (${member.tag})
- Role: ${member.role}
- Town Hall: ${member.townHall}
- Trophies: ${member.trophies}
- Donations: ${member.donations} given, ${member.donationsReceived} received
- Tenure: ${member.tenure} days
- Last Activity: ${(() => {
      const previousMember = roster?.members?.find(prev => prev.tag === member.tag);
      const activity = calculateActivityScore(member, previousMember);
      const estimationNote = !previousMember ? ' *estimated' : '';
      return `${activity.lastActivityDate} (${activity.level})${estimationNote}`;
    })()}
- Rush %: ${member.rushPercent}%
- Heroes: BK:${member.bk || 'N/A'} AQ:${member.aq || 'N/A'} GW:${member.gw || 'N/A'} RC:${member.rc || 'N/A'} MP:${member.mp || 'N/A'}
- Recent Clans: ${member.recentClans?.join(', ') || 'None'}
`).join('')}

Please analyze this clan data and provide insights on:
1. Overall clan health and activity levels
2. Member progression and hero development
3. Donation patterns and clan support
4. Potential areas for improvement
5. Member retention and engagement trends`;

      await navigator.clipboard.writeText(formattedText);
      setMessage("Clan data copied to clipboard! Ready for LLM analysis.");
      setStatus("success");
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setMessage("Failed to copy data to clipboard.");
      setStatus("error");
    }
  };

  // Generate AI summary of current clan state
  const generateAISummary = async () => {
    if (!roster?.members || roster.members.length === 0) {
      setMessage("No roster data available to analyze.");
      setStatus("error");
      return;
    }

    try {
      setStatus("loading");
      setMessage("🤖 Analyzing clan data with AI...");

      // Create a comprehensive summary of the current clan state
      const clanData = {
        clanName: roster.clanName,
        clanTag: clanTag || homeClan,
        memberCount: roster.members.length,
        averageTownHall: Math.round(roster.members.reduce((sum, m) => sum + (getTH(m) || 0), 0) / roster.members.length * 10) / 10,
        averageTrophies: Math.round(roster.members.reduce((sum, m) => sum + (m.trophies || 0), 0) / roster.members.length),
        totalDonations: roster.members.reduce((sum, m) => sum + (m.donations || 0), 0),
        roleDistribution: roster.members.reduce((acc, m) => {
          const role = formatRole(m.role);
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        members: roster.members.map(member => ({
          name: member.name,
          tag: member.tag,
          townHall: getTH(member),
          role: formatRole(member.role),
          trophies: member.trophies,
          donations: member.donations,
          donationsReceived: member.donationsReceived,
          tenure: getTenure(member),
          lastSeen: member.lastSeen,
          rushPercent: rushPercent(member, thCaps),
          heroes: {
            barbarianKing: member.bk,
            archerQueen: member.aq,
            grandWarden: member.gw,
            royalChampion: member.rc,
            minionPrince: member.mp
          }
        }))
      };

      setMessage("🤖 Sending data to OpenAI for analysis...");
      
      const response = await fetch('/api/ai-summary/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanData,
          type: 'full_analysis'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI summary');
      }

      const result = await response.json();
      
      // Store the summary using the snapshots system
      const summary = {
        date: new Date().toISOString().split('T')[0],
        clanTag: clanTag || homeClan || "",
        changes: [], // No changes for full analysis
        summary: result.summary,
        unread: true,
        actioned: false,
        createdAt: new Date().toISOString(),
        type: 'full_analysis'
      };

      // Save using the snapshots API
      const saveResponse = await fetch('/api/snapshots/changes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save',
          changeSummary: summary
        })
      });

      if (!saveResponse.ok) {
        console.warn('Failed to save AI summary to snapshots system');
      }

      setStatus("success");
      setMessage("AI summary generated! Check the Activity Dashboard tab to view it.");
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      setStatus("error");
      setMessage("Failed to generate AI summary. Make sure OpenAI API key is configured.");
    }
  };

  const recordDeparture = async (departureData: { reason: string; notes: string }) => {
    if (!selectedMember || !roster) return;

    try {
      const response = await fetch('/api/departures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag: roster.meta?.clanTag || clanTag,
          action: 'add',
          departure: {
            memberTag: selectedMember.tag,
            memberName: selectedMember.name,
            departureDate: new Date().toISOString().split('T')[0], // Today's date
            departureReason: departureData.reason,
            notes: departureData.notes,
            addedBy: 'Manual Entry',
            lastSeen: new Date().toISOString(),
            lastRole: selectedMember.role,
            lastTownHall: getTH(selectedMember),
            lastTrophies: selectedMember.trophies,
          }
        })
      });

      if (response.ok) {
        setShowDepartureModal(false);
        setSelectedMember(null);
        setMessage(`Recorded departure for ${selectedMember.name}`);
        await checkDepartureNotifications(); // Refresh notifications
      } else {
        setMessage(`Failed to record departure for ${selectedMember.name}`);
      }
    } catch (error) {
      console.error('Failed to record departure:', error);
      setMessage(`Error recording departure for ${selectedMember.name}`);
    }
  };

  // LIVE fetch from server using the typed tag; never hardcoded.
  async function onLoad(tagParam?: string) {
    const raw = (tagParam ?? clanTag ?? "").trim().toUpperCase();
    if (!raw) { setMessage("Enter a clan tag (e.g., #2PR8R8V8P) and press Load."); return; }
    setStatus("loading"); setMessage(`Loading live data for ${raw}…`);
    try {
      const qs = new URLSearchParams({ mode: "live", clanTag: raw }).toString();
      const r = await fetch(`/api/roster?${qs}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to load roster.");
      setRoster(j as Roster);
      setStatus("success");
      setMessage(`Loaded ${j.members?.length ?? 0} members from CoC (${j.clanName || raw}).`);
      setPage(1);
    } catch (e:any) {
      setStatus("error");
      setMessage(e?.message || "Load failed.");
    }
  }

  // -------- Rush % (relative to best-at-TH in current roster) --------
  const thCaps = useMemo(() => calculateThCaps(roster?.members || []), [roster]);

  const rushDetail = (m: Member): string => {
    const th = getTH(m) ?? 0; const caps = thCaps.get(th) || {};
    const lines: string[] = [];
    type HK = "bk"|"aq"|"mp"|"gw"|"rc";
    const order: Array<{label:string,key:HK,th:number}> = [
      { label:"BK", key:"bk", th:7 },
      { label:"AQ", key:"aq", th:9 },
      { label:"MP", key:"mp", th:9 },
      { label:"GW", key:"gw", th:11 },
      { label:"RC", key:"rc", th:13 },
    ];
    const ICON: Record<HK,string> = { bk:"🗡️", aq:"🏹", gw:"🧙", rc:"🛡️", mp:"👑" };
    for (const {label,key,th:need} of order) {
      if (th < need) continue;
      const cap = (caps as any)[key] as number | undefined;
      if (!cap || cap <= 0) continue;
      const raw = (m as any)[key];
      const v = typeof raw === "number" ? raw : (raw != null && !Number.isNaN(Number(raw)) ? Number(raw) : 0);
      const pct = Math.round(Math.max(0, Math.min(1, v / cap)) * 100);
      lines.push(`${ICON[key]} ${label} ${v}/${cap} = ${pct}%`);
    }
    return lines.length ? lines.join("  •  ") : "No eligible heroes with caps";
  };
  const rushClass = (p: number) => p>=70 ? "text-red-700 font-semibold" : p>=40 ? "text-amber-600" : "text-green-700";

  const valFor = (m: Member, key: SortKey) => {
    if (key === "th") return getTH(m);
    if (key === "tenure") return getTenure(m);
    if (key === "activity") {
      // Find previous member data for comparison
      const previousMember = roster?.members?.find(prev => prev.tag === m.tag);
      const activity = calculateActivityScore(m, previousMember);
      return activity.score;
    }
    if (key === "rush") return rushPercent(m, thCaps);
    return (m as any)[key];
  };

  const membersFilteredSorted = useMemo(() => {
    if (!roster?.members) return [];
    let arr = roster.members;
    if (recentClanFilter) {
      const needle = recentClanFilter.trim().toLowerCase();
      arr = arr.filter(m => (m.recentClans||[]).some(c => c.toLowerCase() === needle));
    }
    const sorted = [...arr].sort((a,b) => {
      const va = valFor(a, sortKey), vb = valFor(b, sortKey);
      const sign = sortDir==="asc"?1:-1; return sign * cmp(va, vb);
    });
    return sorted;
  }, [roster, sortKey, sortDir, recentClanFilter]);

  const total = membersFilteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe-1)*pageSize, end = start + pageSize;
  const pageRows = membersFilteredSorted.slice(start, end);

  const toggleSort = (k: SortKey) => {
    if (k===sortKey) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortKey(k); setSortDir("desc"); }
  };


  const headerEl = (k: SortKey, label: string) =>
    <span className="cursor-help hover:underline hover:decoration-dotted hover:underline-offset-2 hover:font-medium" title={HEAD_TIPS[label] || ""}>{label}{sortKey===k?` ${sortDir==="asc"?"▲":"▼"}`:""}</span>;

  const clanName = roster?.clanName ?? roster?.meta?.clanName ?? "";

  return (
    <>
      {/* Modern gradient header */}
      <header className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Left side - Logo */}
          <div className="flex items-center">
            <img 
              src="https://cdn-assets-eu.frontify.com/s3/frontify-enterprise-files-eu/eyJwYXRoIjoic3VwZXJjZWxsXC9maWxlXC91OGFIS25ZUkpQaXlvVHh5a1Q0OC5wbmcifQ:supercell:8_pSWOLovwldaAWJu_t2Q6C91k6oc7p_mY0m9yar7G0?width=1218&format=webp&quality=100"
              alt="Clash of Clans Logo"
              className="h-16 w-auto object-contain"
              onError={(e) => {
                // Fallback to emoji if image fails to load
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'block';
              }}
            />
            <span className="text-4xl hidden">⚔️</span>
          </div>
          
          {/* Center - Clan Name (Prominent) */}
          <div className="text-center">
            <div className="font-bold text-4xl text-white drop-shadow-lg">
              {clanName || "No Clan Loaded"}
            </div>
            <div className="text-lg text-blue-100 mt-1">
              {clanTag || homeClan || "Enter clan tag to load"}
            </div>
          </div>
          
          {/* Right side - App Title & Notifications */}
          <div className="flex flex-col items-end space-y-2">
            <div className="text-right">
              <div className="font-bold text-xl">Clash Intelligence Dashboard</div>
              <div className="text-sm text-blue-100">Advanced Clan Analytics</div>
            </div>
            <div className="flex items-center space-x-4">
              {departureNotifications > 0 && (
                <button
                  onClick={() => setShowDepartureManager(true)}
                  className="relative p-2 hover:bg-indigo-600 rounded-lg transition-colors"
                  title="Member departure notifications"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {departureNotifications}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="relative">
          {/* Tab Container with Background */}
          <div className="bg-white/80 backdrop-blur-sm rounded-t-xl border border-b-0 border-gray-200 shadow-lg">
            <nav className="flex">
              <button
                onClick={() => setActiveTab("roster")}
                className={`relative px-6 py-4 font-medium text-sm transition-all duration-200 ${
                  activeTab === "roster"
                    ? "bg-gradient-to-b from-blue-50 to-white text-blue-700 border-b-2 border-blue-500 shadow-inner"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50/50"
                }`}
              >
                <span className="flex items-center space-x-2">
                  <span>🛡️</span>
                  <span>Roster</span>
                </span>
                {activeTab === "roster" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab("changes")}
                className={`relative px-6 py-4 font-medium text-sm transition-all duration-200 ${
                  activeTab === "changes"
                    ? "bg-gradient-to-b from-blue-50 to-white text-blue-700 border-b-2 border-blue-500 shadow-inner"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50/50"
                }`}
              >
                <span className="flex items-center space-x-2">
                  <span>📈</span>
                  <span>Activity</span>
                </span>
                {activeTab === "changes" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab("database")}
                className={`relative px-6 py-4 font-medium text-sm transition-all duration-200 ${
                  activeTab === "database"
                    ? "bg-gradient-to-b from-blue-50 to-white text-blue-700 border-b-2 border-blue-500 shadow-inner"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50/50"
                }`}
              >
                <span className="flex items-center space-x-2">
                  <span>🗄️</span>
                  <span>Player DB</span>
                </span>
                {activeTab === "database" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab("coaching")}
                className={`relative px-6 py-4 font-medium text-sm transition-all duration-200 ${
                  activeTab === "coaching"
                    ? "bg-gradient-to-b from-blue-50 to-white text-blue-700 border-b-2 border-blue-500 shadow-inner"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50/50"
                }`}
              >
                <span className="flex items-center space-x-2">
                  <span>🤖</span>
                  <span>AI Coaching</span>
                </span>
                {activeTab === "coaching" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className={`relative px-6 py-4 font-medium text-sm transition-all duration-200 ${
                  activeTab === "events"
                    ? "bg-gradient-to-b from-green-50 to-white text-green-700 border-b-2 border-green-500 shadow-inner"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50/50"
                }`}
              >
                <span className="flex items-center space-x-2">
                  <span>📊</span>
                  <span>Events</span>
                </span>
                {activeTab === "events" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab("applicants")}
                className={`relative px-6 py-4 font-medium text-sm transition-all duration-200 ${
                  activeTab === "applicants"
                    ? "bg-gradient-to-b from-orange-50 to-white text-orange-700 border-b-2 border-orange-500 shadow-inner"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50/50"
                }`}
              >
                <span className="flex items-center space-x-2">
                  <span>🎯</span>
                  <span>Applicants</span>
                </span>
                {activeTab === "applicants" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500"></div>
                )}
              </button>
            </nav>
          </div>
        </div>
      </div>

      <main className="min-h-screen p-6 flex flex-col gap-6 max-w-7xl mx-auto bg-gradient-to-br from-white/90 to-blue-50/90 backdrop-blur-sm rounded-b-2xl shadow-xl border border-t-0 border-white/20">
        {activeTab === "roster" ? (
          <>
            {/* Controls */}
        <section className="grid gap-4 p-6 rounded-2xl bg-white/80 backdrop-blur-sm shadow-lg border border-white/20">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Clan Tag</label>
              <div className="flex gap-2">
                <input
                  value={clanTag}
                  onChange={(e) => {
                    let value = e.target.value.toUpperCase();
                    // Auto-add # if not present
                    if (value && !value.startsWith('#')) {
                      value = '#' + value;
                    }
                    setClanTag(value);
                  }}
                  onKeyDown={(e)=>{ if (e.key === "Enter") onLoad().catch(()=>{}); }}
                  className="border rounded-xl px-3 py-2 w-32 focus:outline-none focus:ring"
                  placeholder="2PR8R8V8P"
                  title="Enter a clan tag (with or without #) and press Load"
                />
                <button 
                  onClick={()=>onLoad().catch(()=>{})} 
                  className="rounded-xl px-3 py-2 bg-purple-100 text-purple-700 border border-purple-200 shadow-sm hover:shadow hover:bg-purple-200 transition-colors"
                  title="Load fresh clan data from Clash of Clans API"
                >
                  {status==="loading" ? "⏳ Loading…" : "🔄 Load"}
                </button>
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Home</label>
              <div className="flex gap-2">
                <button 
                  onClick={onSetHome} 
                  className="rounded-xl px-3 py-2 bg-blue-100 text-blue-700 border border-blue-200 shadow-sm hover:shadow hover:bg-blue-200 transition-colors text-sm"
                  title="Set the current clan as your home clan for quick access"
                >
                  🏠 Set Home
                </button>
                <button 
                  onClick={()=>{ setClanTag(homeClan || ""); if (homeClan) onLoad(homeClan).catch(()=>{}); }} 
                  className="rounded-xl px-3 py-2 bg-green-100 text-green-700 border border-green-200 shadow-sm hover:shadow hover:bg-green-200 transition-colors text-sm"
                  title="Load your saved home clan data"
                >
                  🏡 Load Home
                </button>
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Quick Actions</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowCreatePlayerNote(true)} 
                  className="rounded-xl px-3 py-2 bg-blue-100 text-blue-700 border border-blue-200 shadow-sm hover:shadow hover:bg-blue-200 transition-colors text-sm"
                  title="Create a note for a player not currently in the clan"
                >
                  📝 Note
                </button>
                <button 
                  onClick={copyToClipboard} 
                  className="rounded-xl px-3 py-2 bg-green-100 text-green-700 border border-green-200 shadow-sm hover:shadow hover:bg-green-200 transition-colors text-sm"
                  title="Copy all clan data to clipboard for LLM analysis"
                >
                  📋 Copy
                </button>
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">AI Summary</label>
              <button
                onClick={generateAISummary}
                disabled={status === "loading"}
                className="rounded-xl px-3 py-2 bg-purple-100 text-purple-700 border border-purple-200 shadow-sm hover:shadow hover:bg-purple-200 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Generate an AI-powered summary of current clan state and changes"
              >
                {status === "loading" ? "⏳ Generating..." : "🤖 AI Summary"}
              </button>
            </div>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Data & Sorting</label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                <select 
                  value={selectedSnapshot} 
                  onChange={(e) => {
                    setSelectedSnapshot(e.target.value);
                    if (e.target.value === "latest") {
                      loadStoredData(clanTag || homeClan || "").catch(()=>{});
                    } else {
                      loadStoredData(clanTag || homeClan || "", e.target.value).catch(()=>{});
                    }
                  }}
                  className="border rounded-xl px-3 py-2 w-64"
                >
                  <option value="latest">Latest Snapshot</option>
                  {availableSnapshots.map((snapshot) => (
                    <option key={snapshot.date} value={snapshot.date}>
                      {new Date(snapshot.date).toLocaleDateString()} ({snapshot.memberCount} members)
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => loadAvailableSnapshots(clanTag || homeClan || "")}
                  className="rounded-xl px-3 py-2 bg-gray-100 text-gray-700 border border-gray-200 shadow-sm hover:shadow hover:bg-gray-200 transition-colors"
                  title="Refresh the list of available snapshots"
                >
                  🔄 Refresh
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm opacity-70">Sort by</label>
                <select value={sortKey} onChange={(e)=>setSortKey(e.target.value as SortKey)} className="border rounded-xl px-3 py-2">
                  <option value="trophies">trophies</option><option value="name">name</option><option value="th">TH</option>
                  <option value="bk">BK</option><option value="aq">AQ</option><option value="gw">GW</option><option value="rc">RC</option><option value="mp">MP</option>
                  <option value="rush">rush %</option><option value="donations">don</option><option value="donationsReceived">recv</option>
                  <option value="tenure">tenure</option><option value="activity">last activity</option><option value="role">role</option>
                </select>
                <select value={sortDir} onChange={(e)=>setSortDir(e.target.value as "asc"|"desc")} className="border rounded-xl px-3 py-2">
                  <option value="desc">Desc</option><option value="asc">Asc</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm opacity-70">Page size</label>
                <select value={String(pageSize)} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded-xl px-3 py-2">
                  <option value="10">10/page</option><option value="25">25/page</option><option value="50">50/page</option><option value="100">100/page</option>
                </select>
              </div>
            </div>
          </div>

          {message && <p className="text-sm pt-1"><strong>Status:</strong> {message}</p>}
        </section>

        {/* Table */}
        <section className="grid gap-2 p-4 rounded-2xl border overflow-x-auto">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Members</h2>
              {roster && (
                <div className="text-sm text-gray-600">
                  {roster.source === "snapshot" ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      📸 Snapshot: {new Date(roster.date || "").toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      🔴 Live Data
                    </span>
                  )}
                </div>
              )}
            </div>
            <span className="text-xs opacity-70">Showing {Math.min(end, total)} of {total}</span>
          </div>

          {!roster && <p className="opacity-70 text-sm">Load a clan to begin.</p>}
          {roster && total === 0 && <p className="opacity-70 text-sm">No members found for that tag.</p>}

          {roster && total > 0 && (
            <>
              <table className="min-w-full text-sm bg-white/90 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden">
                <thead className="text-left">
                  <tr className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
                    <Th onClick={()=>toggleSort("name")}> {headerEl("name","Name")} </Th>
                    <Th onClick={()=>toggleSort("tag")}>  {headerEl("tag","Tag")}  </Th>
                    <Th onClick={()=>toggleSort("th")}>   {headerEl("th","TH")}   </Th>
                    <Th onClick={()=>toggleSort("bk")} className="bg-slate-100">   {headerEl("bk","BK")}   </Th>
                    <Th onClick={()=>toggleSort("aq")} className="bg-slate-100">   {headerEl("aq","AQ")}   </Th>
                    <Th onClick={()=>toggleSort("gw")} className="bg-slate-100">   {headerEl("gw","GW")}   </Th>
                    <Th onClick={()=>toggleSort("rc")} className="bg-slate-100">   {headerEl("rc","RC")}   </Th>
                    <Th onClick={()=>toggleSort("mp")} className="bg-slate-100">   {headerEl("mp","MP")}   </Th>
                    <Th onClick={()=>toggleSort("rush")}> {headerEl("rush","Rush %")} </Th>
                    <Th onClick={()=>toggleSort("trophies")}> {headerEl("trophies","Trophies")} </Th>
                    <Th onClick={()=>toggleSort("donations")}> {headerEl("donations","Don")} </Th>
                    <Th onClick={()=>toggleSort("donationsReceived")}> {headerEl("donationsReceived","Recv")} </Th>
                    <Th onClick={()=>toggleSort("tenure")}> {headerEl("tenure","Tenure (d)")} </Th>
                    <Th onClick={()=>toggleSort("activity")}> {headerEl("activity","Last Activity")} </Th>
                    <Th onClick={()=>toggleSort("role")}> {headerEl("role","Role")} </Th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((m,i)=> {
                    const th = getTH(m) ?? "";
                    const rp = rushPercent(m, thCaps);
                    return (
                      <tr key={`${m.tag}-${i}`} className={`border-b border-slate-100 last:border-0 transition-colors hover:bg-blue-50/50 ${i%2===1 ? "bg-slate-50/50" : "bg-white/50"}`}>
                        <Td>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleOpenPlayerProfile(m)}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              title="View player profile"
                            >
                              {m.name}
                            </button>
                            {hasNameChanged(m, playerNameHistory) && (
                              <span 
                                className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full"
                                title={`Name changed from "${getPreviousName(m, playerNameHistory)}"`}
                              >
                                📝
                              </span>
                            )}
                          </div>
                        </Td>
                        <Td>{m.tag}</Td>
                        <Td>{th}</Td>
                        <Td className="text-center bg-slate-100">{renderHeroCell(m,"bk")}</Td>
                        <Td className="text-center bg-slate-100">{renderHeroCell(m,"aq")}</Td>
                        <Td className="text-center bg-slate-100">{renderHeroCell(m,"gw")}</Td>
                        <Td className="text-center bg-slate-100">{renderHeroCell(m,"rc")}</Td>
                        <Td className="text-center bg-slate-100">{renderHeroCell(m,"mp")}</Td>
                        <Td className={`text-center ${rushClass(rp)}`}>
                          <span
                            className="cursor-help hover:underline hover:decoration-dotted hover:underline-offset-2 inline-block"
                            title={`${HEAD_TIPS["Rush %"]}\n${rushDetail(m)}`}
                          >
                            {rp}%
                          </span>
                        </Td>
                        <Td>{m.trophies ?? ""}</Td>
                        <Td>
                          <div className="flex flex-col">
                            <span>{m.donations ?? ""}</span>
                            {(() => {
                              const balance = getDonationBalance(m);
                              if (balance.isNegative && balance.balance > 0) {
                                return (
                                  <span className="text-xs text-red-600 font-semibold" title={`Receives ${balance.balance} more than gives`}>
                                    -{balance.balance}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </Td>
                        <Td>{m.donationsReceived ?? ""}</Td>
                        <Td>{getTenure(m)}</Td>
                        <Td>
                          {(() => {
                            // Find previous member data for comparison
                            const previousMember = roster?.members?.find(prev => prev.tag === m.tag);
                            const activity = calculateActivityScore(m, previousMember);
                            
                            return (
                              <span 
                                className="text-sm font-medium"
                                title={`Activity Level: ${activity.level} (${activity.score}/100)\nRecent: ${activity.lastActivity}\nAll indicators: ${activity.indicators.join(', ')}\n\nData Source: ${previousMember ? 'Compared with previous snapshot data' : 'Estimated from current donation activity (donations reset monthly)'}\nNote: ${previousMember ? 'Based on actual changes detected' : '*Estimated - will improve with more snapshot data'}`}
                              >
                                {activity.lastActivityDate}
                                {!previousMember && <span className="ml-1" title="Estimated data - will improve with more snapshot history">*</span>}
                              </span>
                            );
                          })()}
                        </Td>
                        <Td>{renderRole(m.role)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-xl px-3 py-2 border" disabled={pageSafe<=1}>Prev</button>
                <span className="text-sm">Page {pageSafe} / {totalPages}</span>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="rounded-xl px-3 py-2 border" disabled={pageSafe>=totalPages}>Next</button>
              </div>
            </>
          )}
        </section>
          </>
        ) : activeTab === "changes" ? (
          <ChangeDashboard clanTag={clanTag || homeClan || ""} />
        ) : activeTab === "database" ? (
          <PlayerDatabase currentClanMembers={roster?.members?.map(m => m.tag.toUpperCase()) || []} />
        ) : activeTab === "events" ? (
          <EventDashboard 
            eventHistory={eventHistory} 
            roster={roster}
            initialFilterPlayer={eventFilterPlayer}
            onPlayerClick={(member) => {
              setSelectedPlayer(member);
              setShowPlayerProfile(true);
            }}
            onFilterChange={(playerTag) => setEventFilterPlayer(playerTag)}
          />
        ) : activeTab === "applicants" ? (
          <div className="space-y-6">
            {/* Applicant Evaluation Section */}
            <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                🎯 Applicant Evaluation
              </h2>
              <p className="text-gray-600 mb-6">
                Enter a player tag to evaluate their fit for your clan. The system will analyze their Town Hall level, 
                hero development, trophy count, and how well they match your current roster.
              </p>
              
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Player Tag</label>
                  <input
                    type="text"
                    value={applicantTag}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (value && !value.startsWith('#')) {
                        value = '#' + value;
                      }
                      setApplicantTag(value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        fetchApplicantData();
                      }
                    }}
                    className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="#2PR8R8V8P"
                    title="Enter a player tag (with or without #)"
                  />
                </div>
                <button
                  onClick={fetchApplicantData}
                  disabled={applicantLoading}
                  className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {applicantLoading ? "⏳ Evaluating..." : "🔍 Evaluate"}
                </button>
              </div>

              {applicantError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-700 font-medium">Error: {applicantError}</p>
                </div>
              )}

              {applicantData && applicantFitScore && (
                <div className="mt-6 space-y-6">
                  {/* Player Summary */}
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-6 border border-orange-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{applicantData.name}</h3>
                        <p className="text-gray-600">{applicantData.tag}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-orange-600">{applicantFitScore.score}%</div>
                        <div className={`text-sm font-medium ${
                          applicantFitScore.recommendation === 'Excellent' ? 'text-green-600' :
                          applicantFitScore.recommendation === 'Good' ? 'text-blue-600' :
                          applicantFitScore.recommendation === 'Fair' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {applicantFitScore.recommendation} Fit
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Town Hall:</span>
                        <div className="font-medium">TH{applicantData.townHallLevel || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Trophies:</span>
                        <div className="font-medium">{applicantData.trophies?.toLocaleString() || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Donations:</span>
                        <div className="font-medium">{applicantData.donations || 0}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Received:</span>
                        <div className="font-medium">{applicantData.donationsReceived || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold mb-4">Evaluation Breakdown</h4>
                    <div className="space-y-4">
                      {applicantFitScore.breakdown.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.category}</div>
                            <div className="text-sm text-gray-600">{item.details}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              {item.points}/{item.maxPoints}
                            </div>
                            <div className="text-sm text-gray-500">
                              {Math.round((item.points / item.maxPoints) * 100)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className={`p-6 rounded-xl border-2 ${
                    applicantFitScore.recommendation === 'Excellent' ? 'bg-green-50 border-green-200' :
                    applicantFitScore.recommendation === 'Good' ? 'bg-blue-50 border-blue-200' :
                    applicantFitScore.recommendation === 'Fair' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold mb-2">Recommendation</h4>
                        <p className="text-gray-700">
                          {applicantFitScore.recommendation === 'Excellent' && 
                            "🎉 This player would be an excellent addition to your clan! They have strong development and would fit well with your current roster."}
                          {applicantFitScore.recommendation === 'Good' && 
                            "👍 This player shows good potential and would likely be a solid clan member with room for growth."}
                          {applicantFitScore.recommendation === 'Fair' && 
                            "⚠️ This player has some potential but may need development. Consider if you have the resources to help them grow."}
                          {applicantFitScore.recommendation === 'Poor' && 
                            "❌ This player may not be a good fit for your clan at this time. Consider waiting for better candidates."}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          // Remove from Player Database
                          const existingNotes = JSON.parse(localStorage.getItem('playerNotes') || '{}');
                          delete existingNotes[applicantData.tag];
                          localStorage.setItem('playerNotes', JSON.stringify(existingNotes));
                          
                          // Clear the evaluation
                          setApplicantData(null);
                          setApplicantFitScore(null);
                          setApplicantTag("");
                          setApplicantError("");
                          
                          // Show confirmation
                          setMessage(`Removed ${applicantData.name} from Player Database`);
                        }}
                        className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                        title="Remove this player from the Player Database"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          <AICoaching clanData={roster} clanTag={clanTag || homeClan || ""} />
        )}
      </main>

      {/* Departure Manager Modal */}
      {showDepartureManager && (
        <DepartureManager
          clanTag={clanTag || homeClan || ""}
          onClose={() => {
            setShowDepartureManager(false);
            checkDepartureNotifications(); // Refresh notifications after closing
          }}
        />
      )}

      {/* Quick Departure Modal */}
      {showDepartureModal && selectedMember && (
        <QuickDepartureModal
          member={selectedMember}
          onClose={() => {
            setShowDepartureModal(false);
            setSelectedMember(null);
          }}
          onSave={recordDeparture}
        />
      )}

      {/* Player Profile Modal */}
      {showPlayerProfile && selectedPlayer && (
        <PlayerProfileModal
          member={selectedPlayer}
          clanTag={clanTag || homeClan || ""}
          roster={roster}
          playerNameHistory={playerNameHistory}
          eventHistory={eventHistory}
          onClose={() => {
            setShowPlayerProfile(false);
            setSelectedPlayer(null);
          }}
          onViewAllEvents={(playerTag) => {
            setEventFilterPlayer(playerTag);
            setActiveTab("events");
            setShowPlayerProfile(false);
            setSelectedPlayer(null);
          }}
        />
      )}

      {/* Create Player Note Modal */}
      {showCreatePlayerNote && (
        <CreatePlayerNoteModal
          onClose={() => setShowCreatePlayerNote(false)}
        />
      )}

      {/* Version Footer */}
      <footer className="w-full bg-gradient-to-r from-gray-100 to-gray-200 border-t border-gray-300 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>Clash Intelligence Dashboard</span>
              <span className="text-gray-400">•</span>
              <span className="font-mono bg-gray-200 px-2 py-1 rounded text-xs">v0.6</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500">A warfroggy project</span>
            </div>
            <div className="text-xs text-gray-500">
              Built with Next.js • Clash of Clans API
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function Th({ children, onClick }:{ children: React.ReactNode; onClick?: ()=>void }){ return <th className="py-3 px-4 cursor-pointer font-semibold text-slate-700 hover:bg-slate-100/50 transition-colors" onClick={onClick}>{children}</th>; }
function Td({ children, className }:{ children: React.ReactNode; className?: string }){ return <td className={`py-3 px-4 ${className || ""}`}>{children}</td>; }
function rushClass(p:number){ return p>=70 ? "text-red-700 font-semibold" : p>=40 ? "text-amber-600" : "text-green-700"; }

// Event Dashboard Component
function EventDashboard({ 
  eventHistory, 
  roster, 
  initialFilterPlayer,
  onPlayerClick,
  onFilterChange
}: { 
  eventHistory: EventHistory; 
  roster: Roster | null;
  initialFilterPlayer: string;
  onPlayerClick: (member: Member) => void;
  onFilterChange: (playerTag: string) => void;
}) {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPlayer, setFilterPlayer] = useState<string>(initialFilterPlayer);
  const [sortBy, setSortBy] = useState<"date" | "player" | "type">("date");

  // Update filter when initialFilterPlayer changes
  useEffect(() => {
    setFilterPlayer(initialFilterPlayer);
  }, [initialFilterPlayer]);

  // Get all events flattened
  const allEvents = Object.entries(eventHistory)
    .flatMap(([playerTag, events]) => 
      events.map(event => ({ ...event, playerTag }))
    );

  // Filter events
  const filteredEvents = allEvents.filter(event => {
    const typeMatch = filterType === "all" || event.eventType === filterType;
    const playerMatch = filterPlayer === "all" || event.playerTag === filterPlayer;
    return typeMatch && playerMatch;
  });

  // Sort events
  const sortedEvents = filteredEvents.sort((a, b) => {
    switch (sortBy) {
      case "date":
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      case "player":
        return a.playerName.localeCompare(b.playerName);
      case "type":
        return a.eventType.localeCompare(b.eventType);
      default:
        return 0;
    }
  });

  // Get unique event types for filter
  const eventTypes = Array.from(new Set(allEvents.map(e => e.eventType)));

  // Get unique players for filter
  const players = Array.from(new Set(allEvents.map(e => e.playerTag)));

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'th_upgrade': return '🏗️';
      case 'role_change': return '👑';
      case 'trophy_milestone': return '🏆';
      case 'hero_upgrade': return '⚔️';
      case 'donation_milestone': return '💝';
      case 'name_change': return '📝';
      default: return '📊';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'th_upgrade': return 'border-green-200 bg-green-50';
      case 'role_change': return 'border-purple-200 bg-purple-50';
      case 'trophy_milestone': return 'border-yellow-200 bg-yellow-50';
      case 'hero_upgrade': return 'border-blue-200 bg-blue-50';
      case 'donation_milestone': return 'border-orange-200 bg-orange-50';
      case 'name_change': return 'border-gray-200 bg-gray-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getPlayerName = (playerTag: string) => {
    const member = roster?.members?.find(m => m.tag.toUpperCase() === playerTag);
    return member?.name || "Unknown Player";
  };

  const getPlayerMember = (playerTag: string) => {
    return roster?.members?.find(m => m.tag.toUpperCase() === playerTag);
  };

  if (allEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-gray-700 mb-2">No Events Yet</h2>
        <p className="text-gray-500">Significant events will appear here as they happen.</p>
        <p className="text-sm text-gray-400 mt-2">Load fresh data to start tracking events!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Event Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">Track all significant player milestones and achievements</p>
          <p className="text-xs text-gray-500 mt-1">
            {allEvents.length} total events • {filteredEvents.length} filtered
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Events</option>
              {eventTypes.map(type => (
                <option key={type} value={type}>
                  {getEventIcon(type)} {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Player</label>
            <select
              value={filterPlayer}
              onChange={(e) => {
                setFilterPlayer(e.target.value);
                onFilterChange(e.target.value);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Players</option>
              {players.map(tag => (
                <option key={tag} value={tag}>
                  {getPlayerName(tag)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "date" | "player" | "type")}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="date">Date (Newest First)</option>
              <option value="player">Player Name</option>
              <option value="type">Event Type</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {sortedEvents.map((event) => {
          const member = getPlayerMember(event.playerTag);
          return (
            <div
              key={event.id}
              className={`border rounded-lg p-4 ${getEventColor(event.eventType)} hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => member && onPlayerClick(member)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getEventIcon(event.eventType)}</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900">{event.playerName}</h3>
                      <span className="text-xs text-gray-500">({event.playerTag})</span>
                    </div>
                    <p className="text-sm text-gray-700">{event.eventData.details}</p>
                    {event.eventData.milestone && (
                      <p className="text-xs text-gray-600">Milestone: {event.eventData.milestone}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(event.timestamp).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">Click to view profile →</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredEvents.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No events match your current filters.</p>
          <p className="text-sm">Try adjusting the filters above.</p>
        </div>
      )}
    </div>
  );
}

// Player Profile Modal Component
function PlayerProfileModal({ 
  member, 
  clanTag,
  roster,
  playerNameHistory,
  eventHistory,
  onClose,
  onViewAllEvents
}: { 
  member: Member; 
  clanTag: string;
  roster: Roster | null;
  playerNameHistory: Record<string, Array<{name: string, timestamp: string}>>;
  eventHistory: EventHistory;
  onClose: () => void;
  onViewAllEvents: (playerTag: string) => void;
}) {
  const [playerNotes, setPlayerNotes] = useState<Array<{timestamp: string, note: string, customFields: Record<string, string>}>>([]);
  const [newNote, setNewNote] = useState("");
  const [newCustomFields, setNewCustomFields] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [departureHistory, setDepartureHistory] = useState<any[]>([]);

  useEffect(() => {
    loadPlayerData();
  }, [member.tag, clanTag]);

  const loadPlayerData = async () => {
    try {
      setLoading(true);
      // Load timestamped player notes with migration support
      const notesKey = `player_notes_${member.tag}`;
      const fieldsKey = `player_fields_${member.tag}`;
      
      let savedNotes = JSON.parse(localStorage.getItem(notesKey) || "[]");
      
      // Migration: If we have old single-note format, convert it
      if (typeof savedNotes === "string" && savedNotes.trim()) {
        // Old format: single string note
        const oldNote = savedNotes;
        const oldFields = JSON.parse(localStorage.getItem(fieldsKey) || "{}");
        
        // Convert to new timestamped format
        const migratedNote = {
          timestamp: new Date().toISOString(),
          note: oldNote,
          customFields: oldFields
        };
        
        savedNotes = [migratedNote];
        
        // Save the migrated data
        localStorage.setItem(notesKey, JSON.stringify(savedNotes));
        
        // Clean up old format
        localStorage.removeItem(fieldsKey);
        
        console.log(`Migrated old note format for player ${member.tag}`);
      }
      
      setPlayerNotes(savedNotes);

      // Load departure history
      const departureResponse = await fetch(`/api/departures?clanTag=${encodeURIComponent(clanTag)}`);
      if (departureResponse.ok) {
        const departureData = await departureResponse.json();
        const playerDepartures = departureData.departures?.filter((d: any) => d.memberTag === member.tag) || [];
        setDepartureHistory(playerDepartures);
      }
    } catch (error) {
      console.error('Failed to load player data:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePlayerData = async () => {
    try {
      if (!newNote.trim()) {
        alert("Please enter a note");
        return;
      }

      const timestamp = new Date().toISOString();
      const noteData = {
        timestamp,
        note: newNote.trim(),
        customFields: { ...newCustomFields }
      };

      const notesKey = `player_notes_${member.tag}`;
      const updatedNotes = [...playerNotes, noteData];
      localStorage.setItem(notesKey, JSON.stringify(updatedNotes));
      
      setPlayerNotes(updatedNotes);
      setNewNote("");
      setNewCustomFields({});
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save player data:', error);
    }
  };

  const addCustomField = () => {
    const fieldName = prompt("Enter field name:");
    if (fieldName && !newCustomFields[fieldName]) {
      setNewCustomFields(prev => ({ ...prev, [fieldName]: "" }));
    }
  };

  const removeCustomField = (fieldName: string) => {
    setNewCustomFields(prev => {
      const newFields = { ...prev };
      delete newFields[fieldName];
      return newFields;
    });
  };

  const th = getTH(member);
  const thCaps = calculateThCaps(roster?.members || []);
  const rp = rushPercent(member, thCaps);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{member.name}</h2>
              <p className="text-gray-600">{member.tag}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            {isEditing ? (
              <>
                <button
                  onClick={savePlayerData}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Game Stats */}
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Game Statistics</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Player Tag:</span>
                  <p className="text-gray-600">{member.tag}</p>
                </div>
                <div>
                  <span className="font-medium">Role:</span>
                  <div className="text-gray-600">{renderRole(member.role)}</div>
                </div>
                <div>
                  <span className="font-medium">Town Hall:</span>
                  <p className="text-gray-600">{th || "Unknown"}</p>
                </div>
                <div>
                  <span className="font-medium">Trophies:</span>
                  <p className="text-gray-600">{member.trophies || 0}</p>
                </div>
                <div>
                  <span className="font-medium">Donations Given:</span>
                  <p className="text-gray-600">{member.donations || 0}</p>
                </div>
                <div>
                  <span className="font-medium">Donations Received:</span>
                  <p className="text-gray-600">{member.donationsReceived || 0}</p>
                </div>
                <div>
                  <span className="font-medium">War Stars:</span>
                  <p className="text-gray-600">{member.warStars || 0}</p>
                </div>
                <div>
                  <span className="font-medium">Activity Level:</span>
                  <div className="text-gray-600">
                    {(() => {
                      // Find previous member data for comparison
                      const previousMember = roster?.members?.find(prev => prev.tag === member.tag);
                      const activity = calculateActivityScore(member, previousMember);
                      
                      const getActivityColor = (level: string) => {
                        switch (level) {
                          case 'Very Active': return 'text-green-700 bg-green-50';
                          case 'Active': return 'text-blue-700 bg-blue-50';
                          case 'Moderate': return 'text-yellow-700 bg-yellow-50';
                          case 'Low': return 'text-orange-700 bg-orange-50';
                          case 'Inactive': return 'text-red-700 bg-red-50 font-semibold';
                          default: return 'text-gray-700 bg-gray-50';
                        }
                      };
                      
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getActivityColor(activity.level)}`}>
                              {activity.level} (Score: {activity.score}/100)
                            </span>
                            {!previousMember && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded" title="Estimated from current data - will improve with snapshot history">
                                *Estimated
                              </span>
                            )}
                          </div>
                          <div className="text-sm">
                            <p className="font-medium mb-1">Recent Activity:</p>
                            <p className="text-gray-600">{activity.lastActivity}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              <strong>Data Source:</strong> {previousMember 
                                ? 'Compared with previous snapshot data' 
                                : 'Estimated from current donation activity (donations reset monthly)'
                              }
                            </p>
                            {activity.indicators.length > 1 && (
                              <div className="mt-2">
                                <p className="font-medium mb-1">All Indicators:</p>
                                <ul className="text-xs text-gray-600 list-disc list-inside">
                                  {activity.indicators.map((indicator, idx) => (
                                    <li key={idx}>{indicator}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Hero Levels</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Barbarian King:</span>
                  <p className="text-gray-600">{renderHeroCell(member, "bk")}</p>
                </div>
                <div>
                  <span className="font-medium">Archer Queen:</span>
                  <p className="text-gray-600">{renderHeroCell(member, "aq")}</p>
                </div>
                <div>
                  <span className="font-medium">Grand Warden:</span>
                  <p className="text-gray-600">{renderHeroCell(member, "gw")}</p>
                </div>
                <div>
                  <span className="font-medium">Royal Champion:</span>
                  <p className="text-gray-600">{renderHeroCell(member, "rc")}</p>
                </div>
                <div>
                  <span className="font-medium">Minion Prince:</span>
                  <p className="text-gray-600">{renderHeroCell(member, "mp")}</p>
                </div>
                <div>
                  <span className="font-medium">Rush %:</span>
                  <p className={`font-medium ${rushClass(rp)}`}>{rp}%</p>
                </div>
              </div>
            </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-4">Clan History</h3>
                      <div className="text-sm">
                        <div>
                          <span className="font-medium">Recent Clans:</span>
                          <p className="text-gray-600">
                            {member.recentClans && member.recentClans.length > 0 
                              ? member.recentClans.join(", ") 
                              : "None recorded"}
                          </p>
                        </div>
                        <div className="mt-2">
                          <span className="font-medium">Tenure:</span>
                          <p className="text-gray-600">{getTenure(member)} days</p>
                        </div>
                      </div>
                    </div>

                    {/* Name History */}
                    {playerNameHistory[member.tag.toUpperCase()] && playerNameHistory[member.tag.toUpperCase()].length > 1 && (
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-4">Name History</h3>
                        <div className="space-y-2">
                          {playerNameHistory[member.tag.toUpperCase()].map((entry, index) => (
                            <div key={index} className="text-sm border-l-4 border-yellow-300 pl-3">
                              <p><strong>{entry.name}</strong></p>
                              <p className="text-gray-500 text-xs">
                                {new Date(entry.timestamp).toLocaleString()}
                                {index === playerNameHistory[member.tag.toUpperCase()].length - 1 && (
                                  <span className="ml-2 text-green-600 font-medium">(Current)</span>
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Event History */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Significant Events</h3>
                        <button
                          onClick={() => onViewAllEvents(member.tag.toUpperCase())}
                          disabled={!eventHistory[member.tag.toUpperCase()] || eventHistory[member.tag.toUpperCase()].length === 0}
                          className={`px-3 py-1 rounded-lg transition-colors text-sm ${
                            eventHistory[member.tag.toUpperCase()] && eventHistory[member.tag.toUpperCase()].length > 0
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                          title={
                            eventHistory[member.tag.toUpperCase()] && eventHistory[member.tag.toUpperCase()].length > 0
                              ? "View all events for this player"
                              : "No events tracked yet - events are detected when data changes between loads"
                          }
                        >
                          📊 View All Events {eventHistory[member.tag.toUpperCase()] ? `(${eventHistory[member.tag.toUpperCase()].length})` : "(0)"}
                        </button>
                      </div>
                      
                      {/* Debug Info */}
                      <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-100 rounded">
                        <strong>Event Tracking Status:</strong> {eventHistory[member.tag.toUpperCase()] ? 
                          `${eventHistory[member.tag.toUpperCase()].length} events tracked` : 
                          "No events tracked yet"
                        } • Events are detected when you load fresh data and changes are found
                      </div>
                      {eventHistory[member.tag.toUpperCase()] && eventHistory[member.tag.toUpperCase()].length > 0 ? (
                        <div className="space-y-3">
                          {eventHistory[member.tag.toUpperCase()]
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                            .map((event) => (
                            <div key={event.id} className="text-sm border-l-4 border-blue-300 pl-3">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  event.eventType === 'th_upgrade' ? 'bg-green-100 text-green-800' :
                                  event.eventType === 'role_change' ? 'bg-purple-100 text-purple-800' :
                                  event.eventType === 'trophy_milestone' ? 'bg-yellow-100 text-yellow-800' :
                                  event.eventType === 'hero_upgrade' ? 'bg-blue-100 text-blue-800' :
                                  event.eventType === 'donation_milestone' ? 'bg-orange-100 text-orange-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {event.eventType === 'th_upgrade' ? '🏗️ TH Upgrade' :
                                   event.eventType === 'role_change' ? '👑 Role Change' :
                                   event.eventType === 'trophy_milestone' ? '🏆 Trophy Milestone' :
                                   event.eventType === 'hero_upgrade' ? '⚔️ Hero Upgrade' :
                                   event.eventType === 'donation_milestone' ? '💝 Donation Milestone' :
                                   '📝 Event'}
                                </span>
                                <span className="text-gray-500 text-xs">
                                  {new Date(event.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-700 font-medium">{event.eventData.details}</p>
                              {event.eventData.milestone && (
                                <p className="text-gray-600 text-xs">Milestone: {event.eventData.milestone}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          <p className="text-sm">No events tracked yet</p>
                          <p className="text-xs mt-1">Events will appear here when changes are detected between data loads</p>
                        </div>
                      )}
                    </div>
          </div>

          {/* Right Column - Notes & Custom Fields */}
          <div className="space-y-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-4">Player Notes</h3>
                      
                      {/* Display existing notes */}
                      <div className="space-y-3 mb-4">
                        {playerNotes.length === 0 ? (
                          <p className="text-sm text-gray-500">No notes added yet.</p>
                        ) : (
                          playerNotes.map((note, index) => (
                            <div key={index} className="bg-white rounded-lg p-3 border">
                              <div className="text-xs text-gray-500 mb-1">
                                {new Date(note.timestamp).toLocaleString()}
                              </div>
                              <div className="text-sm text-gray-700">{note.note}</div>
                              {Object.keys(note.customFields).length > 0 && (
                                <div className="mt-2 text-xs text-gray-600">
                                  {Object.entries(note.customFields).map(([key, value]) => (
                                    <div key={key}><strong>{key}:</strong> {value}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add new note */}
                      {isEditing ? (
                        <div className="space-y-3">
                          <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Add a new note about this player..."
                            className="w-full h-24 border rounded-lg px-3 py-2"
                          />
                          
                          {/* Custom fields for new note */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium">Custom Fields</label>
                              <button
                                onClick={addCustomField}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                              >
                                Add Field
                              </button>
                            </div>
                            <div className="space-y-2">
                              {Object.entries(newCustomFields).map(([fieldName, fieldValue]) => (
                                <div key={fieldName} className="flex items-center space-x-2">
                                  <span className="font-medium text-xs w-20">{fieldName}:</span>
                                  <input
                                    type="text"
                                    value={fieldValue}
                                    onChange={(e) => setNewCustomFields(prev => ({ ...prev, [fieldName]: e.target.value }))}
                                    className="flex-1 border rounded px-2 py-1 text-xs"
                                  />
                                  <button
                                    onClick={() => removeCustomField(fieldName)}
                                    className="text-red-600 hover:text-red-800 font-semibold"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Add New Note
                        </button>
                      )}
                    </div>


            {/* Departure History */}
            {departureHistory.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Departure History</h3>
                <div className="space-y-2">
                  {departureHistory.map((departure, index) => (
                    <div key={index} className="text-sm border-l-4 border-red-300 pl-3">
                      <p><strong>Date:</strong> {new Date(departure.departureDate).toLocaleDateString()}</p>
                      {departure.departureReason && <p><strong>Reason:</strong> {departure.departureReason}</p>}
                      {departure.notes && <p><strong>Notes:</strong> {departure.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Quick Departure Modal Component
function QuickDepartureModal({ 
  member, 
  onClose, 
  onSave 
}: { 
  member: Member; 
  onClose: () => void; 
  onSave: (data: { reason: string; notes: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    onSave({ reason, notes });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Mark {member.name} as Departed</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p><strong>Member:</strong> {member.name} ({member.tag})</p>
            <p><strong>Role:</strong> {renderRole(member.role)}</p>
            <p><strong>TH:</strong> {getTH(member) || "Unknown"}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Departure Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select a reason...</option>
              <option value="Rage quit">Rage quit</option>
              <option value="Personal reasons">Personal reasons</option>
              <option value="Found another clan">Found another clan</option>
              <option value="Taking a break">Taking a break</option>
              <option value="Inactive">Inactive</option>
              <option value="Kicked">Kicked</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes about this departure..."
              className="w-full border rounded-lg px-3 py-2 h-20"
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!reason}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mark Departed
          </button>
        </div>
      </div>
    </div>
  );
}

