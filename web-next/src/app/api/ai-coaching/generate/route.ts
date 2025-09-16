import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { createApiContext } from '@/lib/api/route-helpers';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/ai-coaching/generate');
  try {
    const body = await request.json();
    const MemberSchema = z.object({
      name: z.string(),
      tag: z.string(),
      role: z.string().optional(),
      townHall: z.number().optional(),
      trophies: z.number().optional(),
      donations: z.number().optional(),
      donationsReceived: z.number().optional(),
      lastSeen: z.number().optional(),
      tenure: z.number().optional(),
      rushPercentage: z.number().optional(),
      heroes: z.any().optional(),
      donationBalance: z.number().optional(),
      isNetReceiver: z.boolean().optional(),
      isLowDonator: z.boolean().optional(),
      isVeryRushed: z.boolean().optional(),
      isRushed: z.boolean().optional(),
    });
    const Schema = z.object({
      clanData: z.object({
        clanName: z.string().optional(),
        clanTag: z.string().optional(),
        memberCount: z.number().optional(),
        members: z.array(MemberSchema),
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
        snapshotSummary: z.string().optional(),
        context: z.string().optional(),
      })
    });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Clan data is required' }, { status: 400 });
    }
    const { clanData } = parsed.data;

    // Inbound rate limit; AI is expensive
    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `ai:coaching:${clanData.clanTag || 'unknown'}:${ip}`;
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

    if (!process.env.OPENAI_API_KEY) {
      return json({ success: false, error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Calculate additional metrics for more specific analysis
    const members = clanData.members;
    const totalDonations = members.reduce((sum: number, m: any) => sum + (m.donations || 0), 0);
    const avgDonations = totalDonations / members.length;
    const topDonators = members.sort((a: any, b: any) => (b.donations || 0) - (a.donations || 0)).slice(0, 3);
    const lowDonators = members.filter((m: any) => (m.donations || 0) < avgDonations * 0.5);
    const inactiveMembers = members.filter((m: any) => typeof m.lastSeen === "number" && m.lastSeen > 3);
    const newMembers = members.filter((m: any) => (m.tenure || 0) < 7);
    const highTrophyMembers = members.filter((m: any) => (m.trophies || 0) > 2000);
    const lowTrophyMembers = members.filter((m: any) => (m.trophies || 0) < 1000);
    const topTrophyGainers = members.sort((a: any, b: any) => (b.trophies || 0) - (a.trophies || 0)).slice(0, 3);

    const prompt = `You are an expert Clash of Clans clan leader. Analyze this SPECIFIC clan data and provide personalized coaching advice based on what's actually happening RIGHT NOW.

CLAN: ${clanData.clanName} (${clanData.clanTag}) - ${clanData.memberCount} members

SNAPSHOT CONTEXT:
${clanData.snapshotSummary || 'No snapshot context available'}

CURRENT CLAN STATUS:
${clanData.snapshotDetails?.currentWar ? `
- Current War: ${clanData.snapshotDetails.currentWar.state} (${clanData.snapshotDetails.currentWar.teamSize} members)
- War Opponent: ${clanData.snapshotDetails.currentWar.opponent?.name || 'Unknown'}
- War End Time: ${clanData.snapshotDetails.currentWar.endTime ? new Date(clanData.snapshotDetails.currentWar.endTime).toLocaleString() : 'Unknown'}
` : '- No active war detected'}

RECENT WAR PERFORMANCE:
${clanData.snapshotDetails?.warLog?.length ? clanData.snapshotDetails.warLog.slice(0, 3).map((war: any) => `
- ${war.endTime ? new Date(war.endTime).toLocaleDateString() : 'Unknown Date'}: ${war.result} vs ${war.opponent.name} (${war.teamSize}x${war.attacksPerMember})
`).join('') : '- No recent war data available'}

CAPITAL RAID ACTIVITY:
${clanData.snapshotDetails?.capitalRaidSeasons?.length ? clanData.snapshotDetails.capitalRaidSeasons.slice(0, 2).map((season: any) => `
- ${season.endTime ? new Date(season.endTime).toLocaleDateString() : 'Unknown Date'}: Hall ${season.capitalHallLevel} - ${season.state} (Off: ${season.offensiveLoot.toLocaleString()}, Def: ${season.defensiveLoot.toLocaleString()})
`).join('') : '- No capital raid data available'}

ADDITIONAL CONTEXT:
${clanData.context || 'No additional context provided'}

SPECIFIC MEMBER DATA (with contextual insights):
${members.map((member: any) => `
${member.name} (${member.tag})
- Role: ${member.role} | TH: ${member.townHall} | Trophies: ${member.trophies}
- Donations: ${member.donations} given, ${member.donationsReceived} received (Balance: ${member.donationBalance > 0 ? '+' : ''}${member.donationBalance})
- Tenure: ${member.tenure} days | Last Seen: ${member.lastSeen} days ago
- Rush Percentage: ${member.rushPercentage}% ${member.isVeryRushed ? '(VERY RUSHED!)' : member.isRushed ? '(rushed)' : '(good)'}
- Heroes: BK:${member.heroes.barbarianKing || 'N/A'} AQ:${member.heroes.archerQueen || 'N/A'} GW:${member.heroes.grandWarden || 'N/A'} RC:${member.heroes.royalChampion || 'N/A'} MP:${member.heroes.minionPrince || 'N/A'}
- Context: ${member.isNetReceiver ? 'Net receiver' : 'Net giver'}${member.isLowDonator ? ', Low donator' : ''}
`).join('')}

CLAN METRICS:
- Average donations per member: ${Math.round(avgDonations)}
- Top donators: ${topDonators.map((m: any) => m.name).join(', ')}
- Members with low donations: ${lowDonators.map((m: any) => m.name).join(', ')}
- Inactive members (>3 days): ${inactiveMembers.map((m: any) => `${m.name} (${m.lastSeen}d)`).join(', ')}
- New members (<7 days): ${newMembers.map((m: any) => m.name).join(', ')}
- High trophy members (>2000): ${highTrophyMembers.map((m: any) => m.name).join(', ')}
- Low trophy members (<1000): ${lowTrophyMembers.map((m: any) => m.name).join(', ')}

Provide 3-5 SPECIFIC, PERSONALIZED recommendations based on what's actually happening in this clan. Use REAL NAMES and SPECIFIC SITUATIONS.

Format each as:
{
  "category": "Specific category",
  "title": "Specific title mentioning actual players/issues",
  "description": "Detailed explanation of the specific situation and what to do about it",
  "chatMessage": "Personalized message mentioning specific players and situations (use real names)",
  "priority": "high/medium/low",
  "icon": "relevant emoji"
}

Focus on SPECIFIC situations like:
- Individual player achievements (e.g., "PlayerX just hit 2500 trophies!")
- Specific donation issues (e.g., "PlayerY and PlayerZ need to step up donations")
- Individual inactive members (e.g., "PlayerA hasn't been seen in 5 days")
- Specific hero upgrade opportunities (e.g., "PlayerB's AQ is ready for level 30")
- Individual trophy situations (e.g., "PlayerC is close to Champion league")
- RUSH SITUATIONS: Be contextually aware! If someone is upgrading heroes but is very rushed (70%+), acknowledge both the progress AND the rush problem
- Donation balance issues (e.g., "PlayerX is receiving more than giving")
- Contextual coaching that considers multiple factors (rush % + hero upgrades + donation patterns)

WAR-READY COACHING:
- If there's an active war, focus on war preparation and attack strategies
- Consider war opponent strength and suggest appropriate attack targets
- Highlight members who should prioritize war attacks over other activities
- Suggest war-specific hero upgrade priorities based on current war status

CAPITAL RAID COACHING:
- If capital raids are active, focus on capital hall upgrades and raid participation
- Suggest capital-specific improvements based on recent raid performance
- Highlight members who should contribute more to capital upgrades
- Consider capital hall level and suggest appropriate upgrade priorities

Make messages PERSONAL and SPECIFIC. Use actual player names. Mention specific numbers and achievements.

IMPORTANT: Be contextually aware! If a player is upgrading heroes but has a high rush percentage (70%+), acknowledge BOTH the progress AND the underlying rush problem. Don't just celebrate hero upgrades without considering the bigger picture.

Return ONLY a valid JSON array.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert Clash of Clans clan leader and coach. Provide actionable advice with ready-to-paste chat messages. Always return valid JSON arrays."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Try to parse the JSON response
    let advice;
    try {
      advice = JSON.parse(content);
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        advice = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    return json({
      success: true,
      data: {
        advice: Array.isArray(advice) ? advice : [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Error generating AI coaching advice:', error);
    return json({ success: false, error: 'Failed to generate coaching advice', message: error.message }, { status: 500 });
  }
}
