// web-next/src/lib/activity-tracker.ts
// Enhanced activity tracking system with real-time detection

import { Member, DailySnapshot, MemberChange } from './snapshots';

const HERO_DISPLAY_NAMES = {
  bk: 'Barbarian King',
  aq: 'Archer Queen',
  gw: 'Grand Warden',
  rc: 'Royal Champion',
  mp: 'Minion Prince',
} as const;

export type ActivityLevel = 'Very High' | 'High' | 'Medium' | 'Low' | 'Inactive';

export type ActivityEvidence = {
  last_active_at: string;
  confidence: 'definitive' | 'high' | 'medium' | 'weak';
  evidence: string[];
  priority: number;
  activity_level: ActivityLevel;
  days_since_activity: number;
};

// Enhanced activity detection with lower thresholds and real-time data
export function calculateEnhancedActivity(
  member: Member,
  changes: MemberChange[],
  snapshotTimestamp: string,
  currentTimestamp?: string
): ActivityEvidence | null {
  const now = new Date(currentTimestamp || new Date().toISOString());
  const snapshotDate = new Date(snapshotTimestamp);
  
  // Get member-specific changes
  const memberChanges = changes.filter(c => c.member.tag === member.tag);
  
  // Check for recent changes (within last 7 days)
  const recentChanges = memberChanges.filter(change => {
    const changeDate = new Date(change.member.tag); // This needs to be fixed
    const daysDiff = (now.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  });

  // Real-time activity indicators from current member data
  const realTimeActivity = calculateRealTimeActivity(member, now);
  
  // Historical activity from changes
  const historicalActivity = calculateHistoricalActivity(memberChanges, snapshotDate);
  
  // Combine evidence
  const allEvidence = [...realTimeActivity, ...historicalActivity];
  
  if (allEvidence.length === 0) {
    return null;
  }

  // Find the best evidence (highest priority)
  const bestEvidence = allEvidence.reduce((best, current) => 
    current.priority > best.priority ? current : best
  );

  // Calculate activity level
  const activityLevel = determineActivityLevel(bestEvidence, now, snapshotDate);
  
  // Calculate days since activity
  const daysSinceActivity = Math.floor(
    (now.getTime() - new Date(bestEvidence.last_active_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    ...bestEvidence,
    activity_level: activityLevel,
    days_since_activity: daysSinceActivity
  };
}

// Real-time activity detection from current member data
function calculateRealTimeActivity(member: Member, now: Date): ActivityEvidence[] {
  const evidence: ActivityEvidence[] = [];
  
  // High donation activity (more sensitive thresholds)
  if (member.donations && member.donations > 0) {
    const donationLevel = getDonationActivityLevel(member.donations);
    if (donationLevel !== 'Inactive') {
      evidence.push({
        last_active_at: now.toISOString(),
        confidence: 'high',
        evidence: [`donations: ${member.donations}`],
        priority: 3,
        activity_level: donationLevel,
        days_since_activity: 0
      });
    }
  }

  // Recent trophy activity (lower threshold)
  if (member.trophies && member.trophies > 0) {
    const trophyLevel = getTrophyActivityLevel(member.trophies);
    if (trophyLevel !== 'Inactive') {
      evidence.push({
        last_active_at: now.toISOString(),
        confidence: 'medium',
        evidence: [`trophies: ${member.trophies}`],
        priority: 2,
        activity_level: trophyLevel,
        days_since_activity: 0
      });
    }
  }

  // Clan Capital contributions (very recent activity)
  if (member.clanCapitalContributions && member.clanCapitalContributions > 0) {
    evidence.push({
      last_active_at: now.toISOString(),
      confidence: 'definitive',
      evidence: [`capital_contributions: ${member.clanCapitalContributions}`],
      priority: 4,
      activity_level: 'Very High',
      days_since_activity: 0
    });
  }

  // Attack wins (war activity)
  if (member.attackWins && member.attackWins > 0) {
    evidence.push({
      last_active_at: now.toISOString(),
      confidence: 'definitive',
      evidence: [`attack_wins: ${member.attackWins}`],
      priority: 5,
      activity_level: 'Very High',
      days_since_activity: 0
    });
  }

  return evidence;
}

// Historical activity from snapshot changes
function calculateHistoricalActivity(changes: MemberChange[], snapshotDate: Date): ActivityEvidence[] {
  const evidence: ActivityEvidence[] = [];
  
  // Process changes with enhanced sensitivity
  for (const change of changes) {
    const priority = getChangePriority(change);
    if (priority > 0) {
      evidence.push({
        last_active_at: snapshotDate.toISOString(),
        confidence: getChangeConfidence(change),
        evidence: [generateEvidenceString(change)],
        priority,
        activity_level: getChangeActivityLevel(change),
        days_since_activity: 0
      });
    }
  }
  
  return evidence;
}

// Enhanced change detection with lower thresholds
export function detectEnhancedChanges(previous: DailySnapshot, current: DailySnapshot): MemberChange[] {
  const changes: MemberChange[] = [];
  
  const prevMembers = new Map(previous.members.map(m => [m.tag, m]));
  const currMembers = new Map(current.members.map(m => [m.tag, m]));
  
  // Check for changes in existing members with enhanced sensitivity
  for (const [tag, currentMember] of currMembers) {
    const prevMember = prevMembers.get(tag);
    if (!prevMember) continue;
    
    // Enhanced donation changes (lower threshold)
    const donationDiff = (currentMember.donations || 0) - (prevMember.donations || 0);
    if (donationDiff >= 25) { // Lowered from 100
      changes.push({
        type: 'donation_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.donations,
        newValue: currentMember.donations,
        description: `${currentMember.name} donated ${donationDiff} troops`
      });
    }
    
    // Enhanced trophy changes (lower threshold)
    const trophyDiff = (currentMember.trophies || 0) - (prevMember.trophies || 0);
    if (Math.abs(trophyDiff) >= 20) { // Lowered from 50
      changes.push({
        type: 'trophy_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.trophies,
        newValue: currentMember.trophies,
        description: `${currentMember.name} ${trophyDiff > 0 ? 'gained' : 'lost'} ${Math.abs(trophyDiff)} trophies`
      });
    }
    
    // Attack wins changes (any increase)
    const attackWinsDiff = (currentMember.attackWins || 0) - (prevMember.attackWins || 0);
    if (attackWinsDiff > 0) {
      changes.push({
        type: 'attack_wins_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.attackWins,
        newValue: currentMember.attackWins,
        description: `${currentMember.name} gained ${attackWinsDiff} attack wins`
      });
    }
    
    // Clan Capital contributions (any increase)
    const capitalContributionsDiff = (currentMember.clanCapitalContributions || 0) - (prevMember.clanCapitalContributions || 0);
    if (capitalContributionsDiff > 0) {
      changes.push({
        type: 'capital_contributions_change',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.clanCapitalContributions,
        newValue: currentMember.clanCapitalContributions,
        description: `${currentMember.name} contributed ${capitalContributionsDiff} capital gold`
      });
    }
    
    // Hero upgrades (any increase)
    const heroes = ['bk', 'aq', 'gw', 'rc', 'mp'] as const;
    for (const hero of heroes) {
      const prevLevel = prevMember[hero];
      const currLevel = currentMember[hero];
      
      if (prevLevel !== currLevel && currLevel !== null && currLevel !== undefined && currLevel > (prevLevel || 0)) {
        const heroName = HERO_DISPLAY_NAMES[hero] || hero.toUpperCase();
        changes.push({
          type: 'hero_upgrade',
          member: {
            name: currentMember.name,
            tag: currentMember.tag,
            townHallLevel: currentMember.townHallLevel,
            role: currentMember.role
          },
          previousValue: prevLevel,
          newValue: currLevel,
          hero: heroName,
          heroKey: hero,
          description: `${currentMember.name} upgraded ${hero.toUpperCase()} to level ${currLevel}`
        });
      }
    }
    
    // Town Hall upgrades
    if (currentMember.townHallLevel !== prevMember.townHallLevel) {
      changes.push({
        type: 'town_hall_upgrade',
        member: {
          name: currentMember.name,
          tag: currentMember.tag,
          townHallLevel: currentMember.townHallLevel,
          role: currentMember.role
        },
        previousValue: prevMember.townHallLevel,
        newValue: currentMember.townHallLevel,
        description: `${currentMember.name} upgraded to Town Hall ${currentMember.townHallLevel}`
      });
    }
  }
  
  return changes;
}

// Helper functions
function getDonationActivityLevel(donations: number): ActivityLevel {
  if (donations >= 1000) return 'Very High';
  if (donations >= 500) return 'High';
  if (donations >= 200) return 'Medium';
  if (donations >= 50) return 'Low';
  return 'Inactive';
}

function getTrophyActivityLevel(trophies: number): ActivityLevel {
  if (trophies >= 5000) return 'Very High';
  if (trophies >= 4000) return 'High';
  if (trophies >= 3000) return 'Medium';
  if (trophies >= 2000) return 'Low';
  return 'Inactive';
}

function getChangePriority(change: MemberChange): number {
  switch (change.type) {
    case 'attack_wins_change': return 5;
    case 'capital_contributions_change': return 4;
    case 'donation_change': return 3;
    case 'hero_upgrade': return 3;
    case 'town_hall_upgrade': return 3;
    case 'trophy_change': return 2;
    case 'versus_battle_wins_change': return 2;
    case 'versus_trophies_change': return 2;
    case 'donation_received_change': return 1;
    case 'role_change': return 1;
    default: return 0;
  }
}

function getChangeConfidence(change: MemberChange): 'definitive' | 'high' | 'medium' | 'weak' {
  switch (change.type) {
    case 'attack_wins_change':
    case 'capital_contributions_change':
    case 'hero_upgrade':
    case 'town_hall_upgrade':
      return 'definitive';
    case 'donation_change':
    case 'trophy_change':
      return 'high';
    case 'versus_battle_wins_change':
    case 'versus_trophies_change':
      return 'medium';
    default:
      return 'weak';
  }
}

function getChangeActivityLevel(change: MemberChange): ActivityLevel {
  switch (change.type) {
    case 'attack_wins_change':
    case 'capital_contributions_change':
      return 'Very High';
    case 'donation_change':
    case 'hero_upgrade':
    case 'town_hall_upgrade':
      return 'High';
    case 'trophy_change':
    case 'versus_battle_wins_change':
      return 'Medium';
    default:
      return 'Low';
  }
}

function determineActivityLevel(evidence: ActivityEvidence, now: Date, snapshotDate: Date): ActivityLevel {
  const daysSinceSnapshot = Math.floor((now.getTime() - snapshotDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // If evidence is from current data (real-time), use its level
  if (evidence.days_since_activity === 0) {
    return evidence.activity_level;
  }
  
  // If evidence is from snapshot, age it based on time
  if (daysSinceSnapshot <= 1) {
    return evidence.activity_level;
  } else if (daysSinceSnapshot <= 3) {
    return downgradeActivityLevel(evidence.activity_level, 1);
  } else if (daysSinceSnapshot <= 7) {
    return downgradeActivityLevel(evidence.activity_level, 2);
  } else {
    return 'Inactive';
  }
}

function downgradeActivityLevel(level: ActivityLevel, steps: number): ActivityLevel {
  const levels: ActivityLevel[] = ['Very High', 'High', 'Medium', 'Low', 'Inactive'];
  const currentIndex = levels.indexOf(level);
  const newIndex = Math.min(currentIndex + steps, levels.length - 1);
  return levels[newIndex];
}

function generateEvidenceString(change: MemberChange): string {
  const type = change.type;
  const prev = change.previousValue;
  const curr = change.newValue;
  
  switch (type) {
    case 'attack_wins_change':
      return `attackWins: +${curr - prev}`;
    case 'donation_change':
      return `donations: +${curr - prev}`;
    case 'capital_contributions_change':
      return `capital_contributions: +${curr - prev}`;
    case 'trophy_change':
      const diff = curr - prev;
      return `trophies: ${diff > 0 ? '+' : ''}${diff}`;
    case 'hero_upgrade':
      return `hero: ${change.description.split(' upgraded ')[1]}`;
    case 'town_hall_upgrade':
      return `townHall: ${prev} → ${curr}`;
    default:
      return `${type}: ${change.description}`;
  }
}
