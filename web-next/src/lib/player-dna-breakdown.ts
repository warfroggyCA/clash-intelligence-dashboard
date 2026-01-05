/**
 * Generate breakdown explanations for Player DNA scores
 * This helps users understand WHY each score is what it is
 */

import type { PlayerDNA, Member } from './player-dna';

export interface DNABreakdown {
  leadership: string;
  performance: string;
  generosity: string;
  social: string;
  specialization: string;
  consistency: string;
}

export function generateDNABreakdown(dna: PlayerDNA, member: Member, clanAverageTenure?: number): DNABreakdown {
  const role = member.role?.toLowerCase() ?? 'member';
  const tenure = member.tenure ?? 0;
  const donations = member.donations ?? 0;
  const donationsReceived = member.donationsReceived ?? 0;
  const warStars = member.warStars ?? 0;
  const capitalContributions = member.clanCapitalContributions ?? 0;
  const trophies = member.trophies ?? 0;

  // Leadership breakdown
  let leadershipBase = 0;
  let leadershipTenure = 0;
  let leadershipExplanation = '';

  if (role === 'leader') {
    leadershipBase = 100;
    leadershipExplanation = 'Leader role: 100 points';
  } else if (role === 'co-leader') {
    leadershipBase = 85;
    leadershipExplanation = 'Co-Leader role: 85 points';
  } else if (role === 'elder') {
    leadershipBase = 60;
    leadershipExplanation = 'Elder role: 60 points';
  } else {
    leadershipBase = 0;
    leadershipExplanation = 'Member role: 0 points (no leadership position)';
  }

  // Tenure bonus description - use neutral tier labels instead of relative terms
  let tenureDescription = '';
  if (tenure > 365) {
    leadershipTenure = 20;
    tenureDescription = `Tenure bonus (${Math.round(tenure)} days, tier 4): +20 points`;
    if (clanAverageTenure) {
      const diff = ((tenure - clanAverageTenure) / clanAverageTenure * 100);
      tenureDescription += `\n  → ${diff > 0 ? `${diff.toFixed(0)}%` : `${Math.abs(diff).toFixed(0)}%`} ${diff > 0 ? 'above' : 'below'} clan average (${Math.round(clanAverageTenure)} days)`;
    }
  } else if (tenure > 180) {
    leadershipTenure = 15;
    tenureDescription = `Tenure bonus (${Math.round(tenure)} days, tier 3): +15 points`;
    if (clanAverageTenure) {
      const diff = ((tenure - clanAverageTenure) / clanAverageTenure * 100);
      tenureDescription += `\n  → ${diff > 0 ? `${diff.toFixed(0)}%` : `${Math.abs(diff).toFixed(0)}%`} ${diff > 0 ? 'above' : 'below'} clan average (${Math.round(clanAverageTenure)} days)`;
    }
  } else if (tenure > 90) {
    leadershipTenure = 10;
    tenureDescription = `Tenure bonus (${Math.round(tenure)} days, tier 2): +10 points`;
    if (clanAverageTenure) {
      const diff = ((tenure - clanAverageTenure) / clanAverageTenure * 100);
      tenureDescription += `\n  → ${diff > 0 ? `${diff.toFixed(0)}%` : `${Math.abs(diff).toFixed(0)}%`} ${diff > 0 ? 'above' : 'below'} clan average (${Math.round(clanAverageTenure)} days)`;
    }
  } else if (tenure > 30) {
    leadershipTenure = 5;
    tenureDescription = `Tenure bonus (${Math.round(tenure)} days, tier 1): +5 points`;
    if (clanAverageTenure) {
      const diff = ((tenure - clanAverageTenure) / clanAverageTenure * 100);
      tenureDescription += `\n  → ${diff > 0 ? `${diff.toFixed(0)}%` : `${Math.abs(diff).toFixed(0)}%`} ${diff > 0 ? 'above' : 'below'} clan average (${Math.round(clanAverageTenure)} days)`;
    }
  } else if (tenure > 0) {
    tenureDescription = `Tenure bonus (${Math.round(tenure)} days, tier 0): +0 points`;
    if (clanAverageTenure) {
      const diff = ((tenure - clanAverageTenure) / clanAverageTenure * 100);
      tenureDescription += `\n  → ${diff > 0 ? `${diff.toFixed(0)}%` : `${Math.abs(diff).toFixed(0)}%`} ${diff > 0 ? 'above' : 'below'} clan average (${Math.round(clanAverageTenure)} days)`;
    }
  } else {
    tenureDescription = 'No tenure recorded: +0 points';
  }

  leadershipExplanation += `\n+ ${tenureDescription}`;

  const leadershipTotal = leadershipBase + leadershipTenure;
  leadershipExplanation = `Leadership Score: ${dna.leadership}/100\n\nBreakdown:\n${leadershipExplanation}\n\nTotal: ${leadershipTotal} points`;

  // Performance breakdown
  const warScore = Math.min(warStars * 4, 40);
  const capitalScore = Math.min(capitalContributions / 1000 * 30, 30);
  const trophyScore = Math.min(trophies / 50, 30);
  const performanceExplanation = `Performance Score: ${dna.performance}/100\n\nBreakdown:\n• War Stars (${warStars}): ${warScore.toFixed(1)}/40 points\n• Capital Contributions (${formatNumber(capitalContributions)}): ${capitalScore.toFixed(1)}/30 points\n• Trophies (${formatNumber(trophies)}): ${trophyScore.toFixed(1)}/30 points\n\nTotal: ${(warScore + capitalScore + trophyScore).toFixed(1)} points`;

  // Generosity breakdown
  const donationRatio = donationsReceived > 0 ? donations / donationsReceived : donations > 0 ? donations / 10 : 0;
  let generosityRatio = 0;
  let generosityRatioText = '';
  if (donationRatio > 2) {
    generosityRatio = 100;
    generosityRatioText = 'Gives 2x+ more than receives: 100 points';
  } else if (donationRatio > 1.5) {
    generosityRatio = 80;
    generosityRatioText = 'Gives 1.5-2x more: 80 points';
  } else if (donationRatio > 1) {
    generosityRatio = 60;
    generosityRatioText = 'Gives more than receives: 60 points';
  } else if (donationRatio > 0.5) {
    generosityRatio = 40;
    generosityRatioText = 'Gives ~50% of what receives: 40 points';
  } else if (donations > 0) {
    generosityRatio = 20;
    generosityRatioText = 'Gives less than receives: 20 points';
  } else {
    generosityRatio = 0;
    generosityRatioText = 'No donations recorded: 0 points';
  }

  let generosityBonus = 0;
  let generosityBonusText = '';
  if (donations > 500) {
    generosityBonus = Math.max(0, 90 - generosityRatio);
    generosityBonusText = `\n+ High donations (${formatNumber(donations)}): +${generosityBonus.toFixed(0)} bonus`;
  } else if (donations > 200) {
    generosityBonus = Math.max(0, 70 - generosityRatio);
    generosityBonusText = `\n+ Good donations (${formatNumber(donations)}): +${generosityBonus.toFixed(0)} bonus`;
  } else if (donations > 50) {
    generosityBonus = Math.max(0, 50 - generosityRatio);
    generosityBonusText = `\n+ Moderate donations (${formatNumber(donations)}): +${generosityBonus.toFixed(0)} bonus`;
  }

  const generosityExplanation = `Generosity Score: ${dna.generosity}/100\n\nBreakdown:\n• Donation ratio (${donationRatio.toFixed(2)}x): ${generosityRatioText}${generosityBonusText}\n\nTotal: ${dna.generosity} points`;

  // Social breakdown
  let socialScore = 0;
  const socialParts: string[] = [];
  if (role === 'leader' || role === 'co-leader') {
    socialScore += 40;
    socialParts.push(`Leadership role: +40`);
  }
  if (donations > 100) {
    socialScore += 30;
    socialParts.push(`Active donor (${formatNumber(donations)}): +30`);
  }
  if (warStars > 10) {
    socialScore += 20;
    socialParts.push(`War participant (${warStars} stars): +20`);
  }
  if (tenure > 180) {
    socialScore += 10;
    let tenureDesc = `Established member (${Math.round(tenure)} days): +10`;
    if (clanAverageTenure) {
      const diff = ((tenure - clanAverageTenure) / clanAverageTenure * 100);
      tenureDesc += ` [${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs clan avg]`;
    }
    socialParts.push(tenureDesc);
  }
  if (socialParts.length === 0) {
    socialParts.push('Limited social engagement: 0 points');
  }
  const socialExplanation = `Social Score: ${dna.social}/100\n\nBreakdown:\n${socialParts.join('\n')}\n\nTotal: ${dna.social} points`;

  // Specialization breakdown
  const specParts: string[] = [];
  let specScore = 0;
  if (capitalContributions > 20000) {
    specScore += 40;
    specParts.push(`Capital expert (${formatNumber(capitalContributions)}): +40`);
  } else if (capitalContributions > 10000) {
    specScore += 30;
    specParts.push(`Capital focused (${formatNumber(capitalContributions)}): +30`);
  } else if (capitalContributions > 5000) {
    specScore += 20;
    specParts.push(`Capital contributor (${formatNumber(capitalContributions)}): +20`);
  }
  if (warStars > 50) {
    specScore += 30;
    specParts.push(`War specialist (${warStars} stars): +30`);
  } else if (warStars > 20) {
    specScore += 20;
    specParts.push(`War focused (${warStars} stars): +20`);
  }
  if (trophies > 4000) {
    specScore += 30;
    specParts.push(`Trophy pusher (${formatNumber(trophies)}): +30`);
  } else if (trophies > 3000) {
    specScore += 20;
    specParts.push(`Trophy focused (${formatNumber(trophies)}): +20`);
  } else if (trophies > 2000) {
    specScore += 10;
    specParts.push(`Trophy active (${formatNumber(trophies)}): +10`);
  }
  if (specParts.length === 0) {
    specParts.push('No specialization area: 0 points');
  }
  const specializationExplanation = `Specialization Score: ${dna.specialization}/100\n\nBreakdown:\n${specParts.join('\n')}\n\nTotal: ${dna.specialization} points`;

  // Consistency breakdown
  const consistencyParts: string[] = [];
  let consistencyScore = 0;
  
  // Tenure points (max 30)
  if (tenure > 365) {
    consistencyScore += 30;
    let tenureDesc = `Tenure tier 4 (${Math.round(tenure)} days): +30`;
    if (clanAverageTenure) {
      const diff = ((tenure - clanAverageTenure) / clanAverageTenure * 100);
      tenureDesc += ` [${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs clan avg]`;
    }
    consistencyParts.push(tenureDesc);
  } else if (tenure > 180) {
    consistencyScore += 22;
    let tenureDesc = `Tenure tier 3 (${Math.round(tenure)} days): +22`;
    if (clanAverageTenure) {
      const diff = ((tenure - clanAverageTenure) / clanAverageTenure * 100);
      tenureDesc += ` [${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs clan avg]`;
    }
    consistencyParts.push(tenureDesc);
  } else if (tenure > 90) {
    consistencyScore += 15;
    let tenureDesc = `Tenure tier 2 (${Math.round(tenure)} days): +15`;
    if (clanAverageTenure) {
      const diff = ((tenure - clanAverageTenure) / clanAverageTenure * 100);
      tenureDesc += ` [${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs clan avg]`;
    }
    consistencyParts.push(tenureDesc);
  } else if (tenure > 30) {
    consistencyScore += 8;
    let tenureDesc = `Tenure tier 1 (${Math.round(tenure)} days): +8`;
    if (clanAverageTenure) {
      const diff = ((tenure - clanAverageTenure) / clanAverageTenure * 100);
      tenureDesc += ` [${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs clan avg]`;
    }
    consistencyParts.push(tenureDesc);
  }
  
  // Activity diversity (max 40)
  let activityTypes = 0;
  if (donations > 0) activityTypes++;
  if (warStars > 0) activityTypes++;
  if (capitalContributions > 0) activityTypes++;
  if (trophies > 1000) activityTypes++;
  
  const activityBonus = activityTypes * 10;
  consistencyScore += activityBonus;
  if (activityTypes > 0) {
    consistencyParts.push(`Activity diversity (${activityTypes} types): +${activityBonus}`);
  } else {
    consistencyParts.push('Limited activity: +0');
  }
  
  // CWL participation (max 30)
  const cwlParticipation = member.cwlParticipationRate ?? null;
  const cwlAttacksUsed = member.cwlAttacksUsed ?? 0;
  const cwlAttacksAvailable = member.cwlAttacksAvailable ?? 0;
  
  if (cwlParticipation !== null && cwlAttacksAvailable > 0) {
    const pctStr = Math.round(cwlParticipation * 100);
    if (cwlParticipation >= 1.0) {
      consistencyScore += 30;
      consistencyParts.push(`⭐ CWL: Perfect attendance (${cwlAttacksUsed}/${cwlAttacksAvailable}): +30`);
    } else if (cwlParticipation >= 0.8) {
      consistencyScore += 20;
      consistencyParts.push(`✅ CWL: ${pctStr}% attendance (${cwlAttacksUsed}/${cwlAttacksAvailable}): +20`);
    } else if (cwlParticipation >= 0.5) {
      consistencyScore += 10;
      consistencyParts.push(`⚠️ CWL: ${pctStr}% attendance (${cwlAttacksUsed}/${cwlAttacksAvailable}): +10`);
    } else {
      const missed = cwlAttacksAvailable - cwlAttacksUsed;
      consistencyScore -= 10;
      consistencyParts.push(`❌ CWL: ${pctStr}% attendance (${missed} attacks missed): -10`);
    }
  } else if (member.cwlReliabilityScore !== null && member.cwlReliabilityScore !== undefined) {
    const cwlBonus = Math.round(member.cwlReliabilityScore * 0.3);
    consistencyScore += cwlBonus;
    consistencyParts.push(`CWL reliability score: +${cwlBonus}`);
  } else {
    consistencyParts.push('CWL: No data available');
  }
  
  if (consistencyParts.length === 0) {
    consistencyParts.push('No consistency indicators: 0 points');
  }
  const consistencyExplanation = `Consistency Score: ${dna.consistency}/100\n\nBreakdown:\n${consistencyParts.join('\n')}\n\nTotal: ${dna.consistency} points`;

  return {
    leadership: leadershipExplanation,
    performance: performanceExplanation,
    generosity: generosityExplanation,
    social: socialExplanation,
    specialization: specializationExplanation,
    consistency: consistencyExplanation,
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value));
}

