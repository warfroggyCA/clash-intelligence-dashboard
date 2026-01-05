/**
 * Player DNA Fingerprinting System
 * 
 * Revolutionary multi-dimensional player classification that predicts behavior patterns
 * and reveals hidden player archetypes through six core dimensions.
 */

export type PlayerDNA = {
  leadership: number;      // 0-100: Role influence, tenure, decision-making
  performance: number;     // 0-100: War stars, attack efficiency, capital raids
  generosity: number;      // 0-100: Donations given vs received, clan support
  social: number;         // 0-100: Chat activity, community engagement
  specialization: number;  // 0-100: Unique strengths, niche expertise
  consistency: number;     // 0-100: Reliability, steady contribution patterns
};

export type PlayerArchetype = 
  | 'Balanced Titan'      // Perfect leadership + performance + generosity combo
  | 'Alpha Donor'         // Leader who gives massive donations
  | 'Paradox Player'      // Takes donations but delivers highest capital performance
  | 'Silent Warrior'      // Elite performance with zero social engagement
  | 'Social Catalyst'     // High social engagement, moderate performance
  | 'Specialist'          // Unique expertise in specific areas
  | 'Grinder'             // Consistent, steady performer
  | 'Potential'           // New member with untapped capabilities
  | 'Veteran'             // Long-tenured, stable contributor
  | 'Wildcard';           // Unpredictable, unique patterns

export type Member = {
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
  attackWins?: number;
  versusBattleWins?: number;
  versusTrophies?: number;
  clanCapitalContributions?: number;
  role?: string;
  tenure?: number;
  rushPercent?: number;
  recentClans?: string[];
  manualActivityOverride?: string;
  
  // CWL participation stats (from cwl-stats service)
  cwlAttacksUsed?: number;
  cwlAttacksAvailable?: number;
  cwlParticipationRate?: number;
  cwlAvgStars?: number;
  cwlThreeStarRate?: number;
  cwlReliabilityScore?: number;
};

/**
 * Calculate Player DNA across six dimensions
 */
export function calculatePlayerDNA(member: Member, clanContext?: {
  averageDonations: number;
  averageWarStars: number;
  averageCapitalContributions: number;
  totalMembers: number;
}): PlayerDNA {
  const donations = member.donations ?? 0;
  const donationsReceived = member.donationsReceived ?? 0;
  const warStars = member.warStars ?? 0;
  const capitalContributions = member.clanCapitalContributions ?? 0;
  const trophies = member.trophies ?? 0;
  const tenure = member.tenure ?? 0;
  const role = member.role?.toLowerCase() ?? '';
  const thLevel = member.townHallLevel ?? member.th ?? 0;

  // 1. LEADERSHIP (0-100)
  let leadership = 0;
  if (role === 'leader') leadership = 100;
  else if (role === 'co-leader') leadership = 85;
  else if (role === 'elder') leadership = 60;
  
  // Tenure bonus (max 20 points)
  if (tenure > 365) leadership += 20;
  else if (tenure > 180) leadership += 15;
  else if (tenure > 90) leadership += 10;
  else if (tenure > 30) leadership += 5;

  // 2. PERFORMANCE (0-100)
  let performance = 0;
  
  // War performance (40% of score)
  if (warStars > 0) {
    const warScore = Math.min(warStars * 4, 40); // Max 40 points
    performance += warScore;
  }
  
  // Capital performance (30% of score)
  if (capitalContributions > 0) {
    const capitalScore = Math.min(capitalContributions / 1000 * 30, 30); // Max 30 points
    performance += capitalScore;
  }
  
  // Trophy performance (30% of score)
  const trophyScore = Math.min(trophies / 50, 30); // Max 30 points
  performance += trophyScore;

  // 3. GENEROSITY (0-100)
  let generosity = 0;
  
  // Donation ratio (primary factor)
  if (donations > 0) {
    const donationRatio = donationsReceived > 0 ? donations / donationsReceived : donations / 10;
    if (donationRatio > 2) generosity = 100; // Gives 2x more than receives
    else if (donationRatio > 1.5) generosity = 80;
    else if (donationRatio > 1) generosity = 60;
    else if (donationRatio > 0.5) generosity = 40;
    else generosity = 20;
  }
  
  // Absolute donation bonus
  if (donations > 500) generosity = Math.max(generosity, 90);
  else if (donations > 200) generosity = Math.max(generosity, 70);
  else if (donations > 50) generosity = Math.max(generosity, 50);

  // 4. SOCIAL (0-100) - Placeholder for future chat analysis
  // For now, based on role and activity patterns
  let social = 0;
  if (role === 'leader' || role === 'co-leader') social += 40;
  if (donations > 100) social += 30; // Active donors are social
  if (warStars > 10) social += 20; // War participants are engaged
  if (tenure > 180) social += 10; // Long-term members are social

  // 5. SPECIALIZATION (0-100)
  let specialization = 0;
  
  // Capital specialization
  if (capitalContributions > 20000) specialization += 40;
  else if (capitalContributions > 10000) specialization += 30;
  else if (capitalContributions > 5000) specialization += 20;
  
  // War specialization
  if (warStars > 50) specialization += 30;
  else if (warStars > 20) specialization += 20;
  
  // Trophy specialization
  if (trophies > 4000) specialization += 30;
  else if (trophies > 3000) specialization += 20;
  else if (trophies > 2000) specialization += 10;

  // 6. CONSISTENCY (0-100)
  let consistency = 0;
  
  // Tenure consistency (max 30 points)
  if (tenure > 365) consistency += 30;
  else if (tenure > 180) consistency += 22;
  else if (tenure > 90) consistency += 15;
  else if (tenure > 30) consistency += 8;
  
  // Activity consistency (based on multiple engagement types) - max 40 points
  let activityTypes = 0;
  if (donations > 0) activityTypes++;
  if (warStars > 0) activityTypes++;
  if (capitalContributions > 0) activityTypes++;
  if (trophies > 1000) activityTypes++;
  
  consistency += activityTypes * 10; // 10 points per activity type (max 40)
  
  // CWL participation bonus (max 30 points) - key reliability indicator
  const cwlParticipation = member.cwlParticipationRate ?? null;
  const cwlReliability = member.cwlReliabilityScore ?? null;
  
  if (cwlParticipation !== null && cwlParticipation >= 0) {
    // Perfect attendance: 30 points
    // 80%+ attendance: 20 points
    // 50%+ attendance: 10 points
    // Below 50%: 0 points (or negative if very low)
    if (cwlParticipation >= 1.0) {
      consistency += 30;
    } else if (cwlParticipation >= 0.8) {
      consistency += 20;
    } else if (cwlParticipation >= 0.5) {
      consistency += 10;
    } else if (cwlParticipation < 0.3 && member.cwlAttacksAvailable && member.cwlAttacksAvailable > 2) {
      // Penalize very low participation (but only if they had real opportunity)
      consistency -= 10;
    }
  } else if (cwlReliability !== null) {
    // Fallback to reliability score if participation rate not available
    consistency += Math.round(cwlReliability * 0.3); // Scale 0-100 to 0-30
  }

  return {
    leadership: Math.min(Math.round(leadership), 100),
    performance: Math.min(Math.round(performance), 100),
    generosity: Math.min(Math.round(generosity), 100),
    social: Math.min(Math.round(social), 100),
    specialization: Math.min(Math.round(specialization), 100),
    consistency: Math.min(Math.round(consistency), 100)
  };
}

/**
 * Classify player into archetype based on DNA profile
 */
export function classifyPlayerArchetype(dna: PlayerDNA, member: Member): PlayerArchetype {
  const { leadership, performance, generosity, social, specialization, consistency } = dna;
  
  // Balanced Titan: High in leadership, performance, and generosity
  if (leadership >= 70 && performance >= 70 && generosity >= 70) {
    return 'Balanced Titan';
  }
  
  // Alpha Donor: High leadership with massive generosity
  if (leadership >= 60 && generosity >= 90) {
    return 'Alpha Donor';
  }
  
  // Paradox Player: Low social but high performance (especially capital)
  if (social <= 30 && performance >= 80) {
    return 'Paradox Player';
  }
  
  // Silent Warrior: High performance, low social
  if (performance >= 70 && social <= 40) {
    return 'Silent Warrior';
  }
  
  // Social Catalyst: High social engagement
  if (social >= 70 && performance >= 40) {
    return 'Social Catalyst';
  }
  
  // Specialist: High specialization in specific areas
  if (specialization >= 70) {
    return 'Specialist';
  }
  
  // Grinder: High consistency, moderate performance
  if (consistency >= 70 && performance >= 40) {
    return 'Grinder';
  }
  
  // Veteran: High tenure and consistency
  if (consistency >= 80 && (member.tenure ?? 0) > 180) {
    return 'Veteran';
  }
  
  // Potential: New member with promise
  if ((member.tenure ?? 0) < 30 && (performance > 0 || (member.donations ?? 0) > 0)) {
    return 'Potential';
  }
  
  // Wildcard: Unpredictable patterns
  return 'Wildcard';
}

/**
 * Get archetype description and characteristics
 */
export function getArchetypeInfo(archetype: PlayerArchetype): {
  description: string;
  strengths: string[];
  optimalRoles: string[];
  color: string;
} {
  const archetypeData = {
    'Balanced Titan': {
      description: 'Perfect leadership + performance + generosity combo. The ideal clan member.',
      strengths: ['Natural leader', 'Consistent performer', 'Generous supporter', 'Team player'],
      optimalRoles: ['Co-Leader', 'War strategist', 'Mentor to new members'],
      color: '#FFD700' // Gold
    },
    'Alpha Donor': {
      description: 'Leader who gives massive donations. The backbone of clan support.',
      strengths: ['Massive donor', 'Clan supporter', 'Resource provider', 'Team enabler'],
      optimalRoles: ['Co-Leader', 'Donation coordinator', 'Resource manager'],
      color: '#32CD32' // Lime Green
    },
    'Paradox Player': {
      description: 'Takes donations but delivers highest capital performance. Strategic specialist.',
      strengths: ['Capital expert', 'High performer', 'Strategic thinker', 'Efficient player'],
      optimalRoles: ['Capital raid leader', 'War specialist', 'Strategy advisor'],
      color: '#4169E1' // Royal Blue
    },
    'Silent Warrior': {
      description: 'Elite performance with zero social engagement. The quiet powerhouse.',
      strengths: ['Elite performer', 'Focused player', 'Reliable contributor', 'Independent'],
      optimalRoles: ['War specialist', 'Capital raid expert', 'Performance leader'],
      color: '#8B0000' // Dark Red
    },
    'Social Catalyst': {
      description: 'High social engagement with moderate performance. The clan connector.',
      strengths: ['Community builder', 'Social connector', 'Team motivator', 'Communication hub'],
      optimalRoles: ['Elder', 'Community manager', 'New member mentor'],
      color: '#FF69B4' // Hot Pink
    },
    'Specialist': {
      description: 'Unique expertise in specific areas. The niche expert.',
      strengths: ['Area expert', 'Technical knowledge', 'Specialized skills', 'Innovation leader'],
      optimalRoles: ['Specialist advisor', 'Training coordinator', 'Innovation leader'],
      color: '#9370DB' // Medium Purple
    },
    'Grinder': {
      description: 'Consistent, steady performer. The reliable backbone.',
      strengths: ['Consistent performer', 'Reliable contributor', 'Steady progress', 'Dependable'],
      optimalRoles: ['Core member', 'War participant', 'Reliable contributor'],
      color: '#228B22' // Forest Green
    },
    'Potential': {
      description: 'New member with untapped capabilities. The future star.',
      strengths: ['High potential', 'Eager to learn', 'Fresh perspective', 'Growth mindset'],
      optimalRoles: ['New member', 'Future leader', 'Growth project'],
      color: '#FFA500' // Orange
    },
    'Veteran': {
      description: 'Long-tenured, stable contributor. The clan foundation.',
      strengths: ['Long-term commitment', 'Stability', 'Experience', 'Loyalty'],
      optimalRoles: ['Elder', 'Clan historian', 'Stability anchor'],
      color: '#708090' // Slate Gray
    },
    'Wildcard': {
      description: 'Unpredictable, unique patterns. The mysterious element.',
      strengths: ['Unpredictable', 'Unique approach', 'Creative thinking', 'Surprise factor'],
      optimalRoles: ['Special projects', 'Innovation team', 'Creative solutions'],
      color: '#800080' // Purple
    }
  };
  
  return archetypeData[archetype];
}

/**
 * Calculate clan DNA summary statistics
 */
export function calculateClanDNA(members: Member[]): {
  averageDNA: PlayerDNA;
  archetypeDistribution: Record<PlayerArchetype, number>;
  clanStrengths: string[];
  improvementAreas: string[];
} {
  if (members.length === 0) {
    return {
      averageDNA: { leadership: 0, performance: 0, generosity: 0, social: 0, specialization: 0, consistency: 0 },
      archetypeDistribution: {} as Record<PlayerArchetype, number>,
      clanStrengths: [],
      improvementAreas: []
    };
  }

  // Calculate clan averages
  const clanAverages = {
    averageDonations: members.reduce((sum, m) => sum + (m.donations ?? 0), 0) / members.length,
    averageWarStars: members.reduce((sum, m) => sum + (m.warStars ?? 0), 0) / members.length,
    averageCapitalContributions: members.reduce((sum, m) => sum + (m.clanCapitalContributions ?? 0), 0) / members.length,
    totalMembers: members.length
  };

  // Calculate DNA for each member
  const memberDNAs = members.map(member => ({
    dna: calculatePlayerDNA(member, clanAverages),
    archetype: classifyPlayerArchetype(calculatePlayerDNA(member, clanAverages), member)
  }));

  // Calculate average DNA
  const averageDNA: PlayerDNA = {
    leadership: Math.round(memberDNAs.reduce((sum, m) => sum + m.dna.leadership, 0) / members.length),
    performance: Math.round(memberDNAs.reduce((sum, m) => sum + m.dna.performance, 0) / members.length),
    generosity: Math.round(memberDNAs.reduce((sum, m) => sum + m.dna.generosity, 0) / members.length),
    social: Math.round(memberDNAs.reduce((sum, m) => sum + m.dna.social, 0) / members.length),
    specialization: Math.round(memberDNAs.reduce((sum, m) => sum + m.dna.specialization, 0) / members.length),
    consistency: Math.round(memberDNAs.reduce((sum, m) => sum + m.dna.consistency, 0) / members.length)
  };

  // Calculate archetype distribution
  const archetypeDistribution: Record<PlayerArchetype, number> = {} as Record<PlayerArchetype, number>;
  memberDNAs.forEach(({ archetype }) => {
    archetypeDistribution[archetype] = (archetypeDistribution[archetype] || 0) + 1;
  });

  // Identify clan strengths and improvement areas
  const clanStrengths: string[] = [];
  const improvementAreas: string[] = [];

  if (averageDNA.leadership > 60) clanStrengths.push('Strong Leadership');
  else if (averageDNA.leadership < 40) improvementAreas.push('Leadership Development');

  if (averageDNA.performance > 60) clanStrengths.push('High Performance');
  else if (averageDNA.performance < 40) improvementAreas.push('Performance Improvement');

  if (averageDNA.generosity > 60) clanStrengths.push('Generous Culture');
  else if (averageDNA.generosity < 40) improvementAreas.push('Donation Culture');

  if (averageDNA.consistency > 60) clanStrengths.push('Reliable Members');
  else if (averageDNA.consistency < 40) improvementAreas.push('Member Retention');

  return {
    averageDNA,
    archetypeDistribution,
    clanStrengths,
    improvementAreas
  };
}
