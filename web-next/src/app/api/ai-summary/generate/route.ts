import { NextRequest, NextResponse } from 'next/server';
import { generateChangeSummary } from '@/lib/ai-summarizer';

export async function POST(request: NextRequest) {
  try {
    const { clanData, type } = await request.json();
    
    if (!clanData) {
      return NextResponse.json({ error: 'Clan data is required' }, { status: 400 });
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
- Role Distribution: ${Object.entries(clanData.roleDistribution).map(([role, count]) => `${role}: ${count}`).join(', ')}

MEMBER ANALYSIS:
${clanData.members.map(member => `
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
      summary = await generateChangeSummary([], clanData.clanTag, new Date().toISOString().split('T')[0], prompt);
    } else {
      return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      summary,
      type,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error generating AI summary:', error);
    return NextResponse.json({ 
      error: 'Failed to generate AI summary',
      details: error.message 
    }, { status: 500 });
  }
}
