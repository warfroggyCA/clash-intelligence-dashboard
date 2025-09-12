/**
 * Client-side activity calculation functions
 * 
 * This file contains activity calculation logic that can be safely used
 * in client-side components without Node.js dependencies.
 */

export type Member = {
  name: string;
  tag: string;
  townHallLevel?: number;
  th?: number;
  bk?: number;
  aq?: number;
  gw?: number;
  rc?: number;
  mp?: number;
  trophies?: number;
  donations?: number;
  donationsReceived?: number;
  warStars?: number;
  attackWins?: number;
  versusBattleWins?: number;
  versusTrophies?: number;
  clanCapitalContributions?: number;
  role?: string;
  tenure?: number;
  rushPercent?: number;
  recentClans?: string[];
  manualActivityOverride?: string;
};

// Real-time activity calculation from current member data
export function calculateRealTimeActivity(member: Member): {
  activity_level: 'Very High' | 'High' | 'Medium' | 'Low' | 'Inactive';
  confidence: 'definitive' | 'high' | 'medium' | 'weak';
  evidence: string[];
  last_active_at: string;
} {
  const now = new Date().toISOString();
  const evidence: string[] = [];
  let activity_level: 'Very High' | 'High' | 'Medium' | 'Low' | 'Inactive' = 'Inactive';
  let confidence: 'definitive' | 'high' | 'medium' | 'weak' = 'weak';

  // Check donation activity (most reliable indicator)
  if (member.donations && member.donations > 0) {
    if (member.donations >= 500) {
      activity_level = 'Very High';
      confidence = 'high';
      evidence.push(`donations: ${member.donations}`);
    } else if (member.donations >= 200) {
      activity_level = 'High';
      confidence = 'high';
      evidence.push(`donations: ${member.donations}`);
    } else if (member.donations >= 100) {
      activity_level = 'Medium';
      confidence = 'medium';
      evidence.push(`donations: ${member.donations}`);
    } else if (member.donations >= 25) {
      activity_level = 'Low';
      confidence = 'medium';
      evidence.push(`donations: ${member.donations}`);
    }
  }

  // Check attack wins (war activity - highest priority)
  if (member.attackWins && member.attackWins > 0) {
    activity_level = 'Very High';
    confidence = 'definitive';
    evidence.push(`attack_wins: ${member.attackWins}`);
  }

  // Note: Clan Capital contributions are not available in the CoC API
  // This would require a separate API call or manual tracking

  // Check versus battle activity
  if (member.versusBattleWins && member.versusBattleWins > 0) {
    if (activity_level === 'Inactive') {
      activity_level = 'Medium';
      confidence = 'medium';
    }
    evidence.push(`versus_battles: ${member.versusBattleWins}`);
  }

  // Check trophy level (indicates recent play) - more sensitive thresholds
  if (member.trophies && member.trophies > 0) {
    if (member.trophies >= 3000) {
      // High trophy level indicates very active player
      activity_level = 'High';
      confidence = 'high';
      evidence.push(`trophies: ${member.trophies}`);
    } else if (member.trophies >= 2000) {
      // Medium trophy level indicates active player
      activity_level = 'Medium';
      confidence = 'medium';
      evidence.push(`trophies: ${member.trophies}`);
    } else if (member.trophies >= 1000) {
      // Low trophy level indicates some activity
      activity_level = 'Low';
      confidence = 'medium';
      evidence.push(`trophies: ${member.trophies}`);
    } else if (member.trophies >= 500) {
      // Very low trophy level indicates minimal activity
      activity_level = 'Low';
      confidence = 'weak';
      evidence.push(`trophies: ${member.trophies}`);
    }
    
  }

  // Check donations received (indicates clan activity)
  if (member.donationsReceived && member.donationsReceived > 0) {
    if (member.donationsReceived >= 200) {
      if (activity_level === 'Inactive') {
        activity_level = 'High';
        confidence = 'high';
      } else if (activity_level === 'Low') {
        activity_level = 'Medium';
      }
      evidence.push(`donations_received: ${member.donationsReceived}`);
    } else if (member.donationsReceived >= 50) {
      if (activity_level === 'Inactive') {
        activity_level = 'Medium';
        confidence = 'medium';
      }
      evidence.push(`donations_received: ${member.donationsReceived}`);
    }
  }

  return {
    activity_level,
    confidence,
    evidence,
    last_active_at: now
  };
}

