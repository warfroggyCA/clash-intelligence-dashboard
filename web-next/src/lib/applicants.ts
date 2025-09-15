import type { Member } from '@/types';
import { HERO_MAX_LEVELS } from '@/types';

export type ApplicantRecommendation = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export interface ApplicantEvaluationBreakdownItem {
  category: string;
  points: number;
  maxPoints: number;
  details: string;
}

export interface ApplicantEvaluationResult {
  score: number; // 0-100
  recommendation: ApplicantRecommendation;
  breakdown: ApplicantEvaluationBreakdownItem[];
}

/**
 * Evaluate an applicant against simple criteria and optional clan context.
 * If roster is omitted, Clan Fit is treated as neutral (10/15).
 */
export function evaluateApplicant(applicant: Member, currentRoster?: Member[]): ApplicantEvaluationResult {
  const breakdown: ApplicantEvaluationBreakdownItem[] = [];
  let totalScore = 0;
  let maxTotalScore = 0;

  // 1) Town Hall (0-25)
  const th = applicant.townHallLevel ?? 0;
  let thScore = 0;
  let thDetails = '';
  if (th >= 15) { thScore = 25; thDetails = 'TH15+ - High level'; }
  else if (th >= 13) { thScore = 20; thDetails = 'TH13-14 - Strong'; }
  else if (th >= 11) { thScore = 15; thDetails = 'TH11-12 - Good'; }
  else if (th >= 9) { thScore = 10; thDetails = 'TH9-10 - Decent'; }
  else { thScore = 5; thDetails = 'TH8 or below - Low'; }
  breakdown.push({ category: 'Town Hall Level', points: thScore, maxPoints: 25, details: thDetails });
  totalScore += thScore; maxTotalScore += 25;

  // 2) Hero Development (0-30) based on TH caps
  const heroes = [ applicant.bk ?? 0, applicant.aq ?? 0, applicant.gw ?? 0, applicant.rc ?? 0, applicant.mp ?? 0 ];
  const caps = HERO_MAX_LEVELS[th] || { bk: 0, aq: 0, gw: 0, rc: 0, mp: 0 } as any;
  const maxes = [ caps.bk || 0, caps.aq || 0, caps.gw || 0, caps.rc || 0, caps.mp || 0 ];
  const progresses = heroes.map((lvl, i) => (maxes[i] > 0 ? (lvl / maxes[i]) * 100 : 0));
  const valid = progresses.filter(p => p > 0);
  const avg = valid.length ? valid.reduce((s, p) => s + p, 0) / valid.length : 0;
  let heroScore = 0; let heroDetails = '';
  if (avg >= 80) { heroScore = 30; heroDetails = 'Excellent hero development (80%+)'; }
  else if (avg >= 60) { heroScore = 25; heroDetails = 'Good hero development (60-79%)'; }
  else if (avg >= 40) { heroScore = 15; heroDetails = 'Moderate hero development (40-59%)'; }
  else if (avg > 0) { heroScore = 10; heroDetails = 'Poor hero development (<40%)'; }
  else { heroScore = 0; heroDetails = 'No heroes developed'; }
  breakdown.push({ category: 'Hero Development', points: heroScore, maxPoints: 30, details: heroDetails });
  totalScore += heroScore; maxTotalScore += 30;

  // 3) Trophy Count (0-20)
  const trophies = applicant.trophies ?? 0;
  let trophyScore = 0; let trophyDetails = '';
  if (trophies >= 5000) { trophyScore = 20; trophyDetails = '5000+ trophies - Elite'; }
  else if (trophies >= 4000) { trophyScore = 15; trophyDetails = '4000+ trophies - Strong'; }
  else if (trophies >= 3000) { trophyScore = 10; trophyDetails = '3000+ trophies - Good'; }
  else if (trophies >= 2000) { trophyScore = 5; trophyDetails = '2000+ trophies - Average'; }
  else { trophyScore = 0; trophyDetails = 'Under 2000 - Low activity'; }
  breakdown.push({ category: 'Trophy Count', points: trophyScore, maxPoints: 20, details: trophyDetails });
  totalScore += trophyScore; maxTotalScore += 20;

  // 4) Clan Fit (0-15) vs avg roster TH; neutral if roster unknown
  let fitScore = 10; // neutral default
  let fitDetails = 'Neutral fit (no roster context)';
  if (currentRoster && currentRoster.length) {
    const ths = currentRoster.map(m => m.townHallLevel ?? 0).filter(n => n > 0);
    const avgTh = ths.length ? ths.reduce((s, n) => s + n, 0) / ths.length : 0;
    const diff = Math.abs((th || 0) - avgTh);
    if (diff <= 1) { fitScore = 15; fitDetails = `Perfect fit - TH${th} ~ clan avg TH${avgTh.toFixed(1)}`; }
    else if (diff <= 2) { fitScore = 10; fitDetails = `Good fit - TH${th} close to TH${avgTh.toFixed(1)}`; }
    else if (diff <= 3) { fitScore = 5; fitDetails = `Fair fit - TH${th} vs TH${avgTh.toFixed(1)}`; }
    else { fitScore = 0; fitDetails = `Poor fit - TH${th} vs TH${avgTh.toFixed(1)}`; }
  }
  breakdown.push({ category: 'Clan Fit', points: fitScore, maxPoints: 15, details: fitDetails });
  totalScore += fitScore; maxTotalScore += 15;

  // 5) Activity via donations (0-10)
  const donations = applicant.donations ?? 0;
  const recvd = applicant.donationsReceived ?? 0;
  const totalDon = donations + recvd;
  let actScore = 0; let actDetails = '';
  if (totalDon >= 500) { actScore = 10; actDetails = 'Very active - High donations'; }
  else if (totalDon >= 200) { actScore = 7; actDetails = 'Active - Good donations'; }
  else if (totalDon >= 50) { actScore = 4; actDetails = 'Moderate - Some donations'; }
  else { actScore = 0; actDetails = 'Low activity - Minimal donations'; }
  breakdown.push({ category: 'Activity Level', points: actScore, maxPoints: 10, details: actDetails });
  totalScore += actScore; maxTotalScore += 10;

  const pct = maxTotalScore ? (totalScore / maxTotalScore) * 100 : 0;
  let recommendation: ApplicantRecommendation = 'Poor';
  if (pct >= 80) recommendation = 'Excellent';
  else if (pct >= 60) recommendation = 'Good';
  else if (pct >= 40) recommendation = 'Fair';

  return { score: Math.round(pct), recommendation, breakdown };
}

/**
 * Compute rush percentage using TH caps from HERO_MAX_LEVELS.
 * 0% = not rushed, 100% = fully rushed relative to caps across available heroes.
 */
export function computeRushPercent(member: Member): number {
  const th = member.townHallLevel ?? 0;
  const caps = HERO_MAX_LEVELS[th] || ({} as any);
  const keys: (keyof typeof caps)[] = ['bk','aq','gw','rc','mp'].filter(k => typeof (caps as any)[k] === 'number' && (caps as any)[k]! > 0) as any;
  if (!keys.length) return 0;
  let total = 0;
  for (const k of keys) {
    const cap = (caps as any)[k] as number;
    const current = (member as any)[k] ?? 0;
    total += Math.max(0, cap - current) / cap;
  }
  return Math.round((total / keys.length) * 100);
}
