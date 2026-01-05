import { NextRequest } from 'next/server';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getCwlStats, getPlayerCwlStats, calculateCwlReliabilityScore, summarizeCwlPerformance } from '@/lib/cwl-stats';

/**
 * GET /api/cwl/stats
 * 
 * Get CWL participation and performance statistics.
 * 
 * Query params:
 * - clanTag: Clan tag (defaults to homeClanTag)
 * - seasonId: Specific season (e.g., "2026-01"), or omit for all-time
 * - playerTag: Specific player, or omit for all players
 * - seasonsBack: Number of seasons to look back (default: all)
 */
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/cwl/stats');
  const { searchParams } = new URL(request.url);
  
  const clanTagParam = searchParams.get('clanTag') || cfg.homeClanTag || '';
  const seasonId = searchParams.get('seasonId') || undefined;
  const playerTagParam = searchParams.get('playerTag') || undefined;
  const seasonsBackParam = searchParams.get('seasonsBack');
  
  const clanTag = normalizeTag(clanTagParam);
  if (!clanTag || !isValidTag(clanTag)) {
    return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
  }
  
  const seasonsBack = seasonsBackParam ? parseInt(seasonsBackParam, 10) : undefined;
  
  try {
    // If requesting a specific player
    if (playerTagParam) {
      const playerTag = normalizeTag(playerTagParam);
      if (!playerTag || !isValidTag(playerTag)) {
        return json({ success: false, error: 'Invalid player tag' }, { status: 400 });
      }
      
      const playerStats = await getPlayerCwlStats(clanTag, playerTag);
      
      if (!playerStats) {
        return json({ 
          success: true, 
          data: {
            playerTag,
            hasData: false,
            message: 'No CWL data found for this player',
          }
        });
      }
      
      const reliabilityScore = calculateCwlReliabilityScore(playerStats);
      const summary = summarizeCwlPerformance(playerStats);
      
      return json({
        success: true,
        data: {
          ...playerStats,
          reliabilityScore,
          summary,
        },
      });
    }
    
    // Get clan-wide stats
    const clanStats = await getCwlStats({
      clanTag,
      seasonId,
      seasonsBack,
    });
    
    if (!clanStats) {
      return json({
        success: true,
        data: {
          clanTag,
          hasData: false,
          message: 'No CWL data found for this clan',
        },
      });
    }
    
    // Add reliability scores to all players
    const playersWithScores = clanStats.playerStats.map(p => ({
      ...p,
      reliabilityScore: calculateCwlReliabilityScore(p),
      summary: summarizeCwlPerformance(p),
    }));
    
    // Sort by reliability for the main list
    playersWithScores.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
    
    return json({
      success: true,
      data: {
        ...clanStats,
        playerStats: playersWithScores,
        // Quick stats for leadership review
        highlights: {
          perfectAttendance: playersWithScores.filter(p => p.participationRate === 1).length,
          highPerformers: playersWithScores.filter(p => p.avgStars >= 2.5 && p.attacksUsed >= 3).length,
          needsImprovement: playersWithScores.filter(p => p.participationRate < 0.8 && p.attacksAvailable > 0).length,
          missedAttacksTotal: clanStats.missedAttacks.reduce((sum, m) => sum + m.missedCount, 0),
        },
      },
    });
    
  } catch (error: any) {
    console.error('[cwl/stats] Error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

