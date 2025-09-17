import { NextRequest, NextResponse } from 'next/server';
import { generateChangeSummary } from '@/lib/ai-summarizer';
import { z } from 'zod';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { createApiContext } from '@/lib/api/route-helpers';
import type { ApiResponse } from '@/types';
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/ai-summary/generate');
  try {
    const body = await request.json();
    const Schema = z.object({
      type: z.literal('full_analysis'),
      clanData: z.object({
        clanName: z.string().optional(),
        clanTag: z.string().optional(),
        memberCount: z.number().optional(),
        averageTownHall: z.number().optional(),
        averageTrophies: z.number().optional(),
        totalDonations: z.number().optional(),
        roleDistribution: z.record(z.number()).optional(),
        members: z.array(z.any()).optional(),
        snapshotMetadata: z.object({
          snapshotDate: z.string(),
          fetchedAt: z.string(),
          memberCount: z.number(),
          warLogEntries: z.number(),
          capitalSeasons: z.number(),
          version: z.string(),
        }).optional(),
        snapshotDetails: z.object({
          currentWar: z.object({
            state: z.string(),
            teamSize: z.number(),
            opponent: z.object({
              name: z.string(),
              tag: z.string(),
            }).optional(),
            attacksPerMember: z.number().optional(),
            startTime: z.string().optional(),
            endTime: z.string().optional(),
          }).optional(),
          warLog: z.array(z.any()).optional(),
          capitalRaidSeasons: z.array(z.any()).optional(),
        }).optional(),
      })
    });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
    const { clanData, type } = parsed.data;

    // Inbound rate limit (AI)
    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `ai:summary:${clanData.clanTag || 'unknown'}:${ip}`;
    const limit = await rateLimitAllow(key, { windowMs: 60_000, max: 5 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 5),
        }
      });
    }

    let summary: string;

    if (type === 'full_analysis') {
      // Generate a comprehensive analysis of the current clan state
      const prompt = `Analyze this Clash of Clans clan data and provide a comprehensive summary:

CLAN OVERVIEW:
- Name: ${clanData.clanName} (${clanData.clanTag})
- Total Members: ${clanData.memberCount}
- Average Town Hall Level: ${clanData.averageTownHall}
- Average Trophies: ${clanData.averageTrophies}
- Total Donations: ${clanData.totalDonations}
- Role Distribution: ${Object.entries(clanData.roleDistribution || {}).map(([role, count]) => `${role}: ${count}`).join(', ')}

SNAPSHOT CONTEXT:
- Data Source: Latest nightly snapshot
- Analysis Date: ${new Date().toLocaleDateString()}
- Data Freshness: ${clanData.snapshotMetadata?.fetchedAt
        ? `Fetched ${safeLocaleString(clanData.snapshotMetadata.fetchedAt, {
            fallback: 'Unknown',
            context: 'AI summary snapshotMetadata.fetchedAt'
          })}`
        : 'Unknown'}

CURRENT CLAN STATUS:
${clanData.snapshotDetails?.currentWar ? `
- Current War: ${clanData.snapshotDetails.currentWar.state} (${clanData.snapshotDetails.currentWar.teamSize} members)
- War Opponent: ${clanData.snapshotDetails.currentWar.opponent?.name || 'Unknown'}
- War End Time: ${safeLocaleString(clanData.snapshotDetails.currentWar.endTime, {
        fallback: 'Unknown',
        context: 'AI summary currentWar.endTime'
      })}
` : '- No active war detected'}

RECENT WAR PERFORMANCE:
${clanData.snapshotDetails?.warLog?.length ? clanData.snapshotDetails.warLog.slice(0, 3).map((war: any) => `
- ${safeLocaleDateString(war.endTime, {
          fallback: 'Unknown Date',
          context: 'AI summary warLog endTime'
        })}: ${war.result} vs ${war.opponent.name} (${war.teamSize}x${war.attacksPerMember})
`).join('') : '- No recent war data available'}

CAPITAL RAID ACTIVITY:
${clanData.snapshotDetails?.capitalRaidSeasons?.length ? clanData.snapshotDetails.capitalRaidSeasons.slice(0, 2).map((season: any) => `
- ${safeLocaleDateString(season.endTime, {
          fallback: 'Unknown Date',
          context: 'AI summary capital season endTime'
        })}: Hall ${season.capitalHallLevel} - ${season.state} (Off: ${season.offensiveLoot.toLocaleString()}, Def: ${season.defensiveLoot.toLocaleString()})
`).join('') : '- No capital raid data available'}

MEMBER ANALYSIS:
${(clanData.members || []).map((member: any) => `
${member.name} (${member.tag})
- Role: ${member.role}
- Town Hall: ${member.townHall}
- Trophies: ${member.trophies}
- Donations: ${member.donations} given, ${member.donationsReceived} received
- Tenure: ${member.tenure} days
- Last Seen: ${member.lastSeen} days ago
- Rush %: ${member.rushPercent}%
- Heroes: BK:${member.heroes.barbarianKing || 'N/A'} AQ:${member.heroes.archerQueen || 'N/A'} GW:${member.heroes.grandWarden || 'N/A'} RC:${member.heroes.royalChampion || 'N/A'} MP:${member.heroes.minionPrince || 'N/A'}
`).join('')}

Please provide a comprehensive analysis covering:
1. Overall clan health and activity levels
2. Member progression and hero development patterns
3. Donation patterns and clan support
4. Potential areas for improvement
5. Member retention and engagement insights
6. Notable achievements or concerns
7. Recommendations for clan management

Format your response as a clear, actionable summary that would be useful for clan leadership.`;

      // Use the existing AI summarizer but with a custom prompt
      summary = await generateChangeSummary([], clanData.clanTag || '#UNKNOWN', new Date().toISOString().split('T')[0], prompt);
    } else {
      return json({ success: false, error: 'Invalid analysis type' }, { status: 400 });
    }

    return json({
      success: true,
      data: { summary, type, timestamp: new Date().toISOString() }
    });

  } catch (error: any) {
    console.error('Error generating AI summary:', error);
    return json({ success: false, error: 'Failed to generate AI summary', message: error.message }, { status: 500 });
  }
}
