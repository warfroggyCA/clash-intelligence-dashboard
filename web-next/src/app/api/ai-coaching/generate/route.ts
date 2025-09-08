import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { clanData } = await request.json();
    
    if (!clanData) {
      return NextResponse.json({ error: 'Clan data is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Calculate additional metrics for more specific analysis
    const members = clanData.members;
    const totalDonations = members.reduce((sum, m) => sum + (m.donations || 0), 0);
    const avgDonations = totalDonations / members.length;
    const topDonators = members.sort((a, b) => (b.donations || 0) - (a.donations || 0)).slice(0, 3);
    const lowDonators = members.filter(m => (m.donations || 0) < avgDonations * 0.5);
    const inactiveMembers = members.filter(m => typeof m.lastSeen === "number" && m.lastSeen > 3);
    const newMembers = members.filter(m => (m.tenure || 0) < 7);
    const highTrophyMembers = members.filter(m => (m.trophies || 0) > 2000);
    const lowTrophyMembers = members.filter(m => (m.trophies || 0) < 1000);
    const topTrophyGainers = members.sort((a, b) => (b.trophies || 0) - (a.trophies || 0)).slice(0, 3);

    const prompt = `You are an expert Clash of Clans clan leader. Analyze this SPECIFIC clan data and provide personalized coaching advice based on what's actually happening RIGHT NOW.

CLAN: ${clanData.clanName} (${clanData.clanTag}) - ${clanData.memberCount} members

SPECIFIC MEMBER DATA:
${members.map(member => `
${member.name} (${member.tag})
- Role: ${member.role} | TH: ${member.townHall} | Trophies: ${member.trophies}
- Donations: ${member.donations} given, ${member.donationsReceived} received
- Tenure: ${member.tenure} days | Last Seen: ${member.lastSeen} days ago
- Heroes: BK:${member.heroes.barbarianKing || 'N/A'} AQ:${member.heroes.archerQueen || 'N/A'} GW:${member.heroes.grandWarden || 'N/A'} RC:${member.heroes.royalChampion || 'N/A'} MP:${member.heroes.minionPrince || 'N/A'}
`).join('')}

CLAN METRICS:
- Average donations per member: ${Math.round(avgDonations)}
- Top donators: ${topDonators.map(m => m.name).join(', ')}
- Members with low donations: ${lowDonators.map(m => m.name).join(', ')}
- Inactive members (>3 days): ${inactiveMembers.map(m => `${m.name} (${m.lastSeen}d)`).join(', ')}
- New members (<7 days): ${newMembers.map(m => m.name).join(', ')}
- High trophy members (>2000): ${highTrophyMembers.map(m => m.name).join(', ')}
- Low trophy members (<1000): ${lowTrophyMembers.map(m => m.name).join(', ')}

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

Make messages PERSONAL and SPECIFIC. Use actual player names. Mention specific numbers and achievements.

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

    return NextResponse.json({
      success: true,
      advice: Array.isArray(advice) ? advice : [],
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error generating AI coaching advice:', error);
    return NextResponse.json({ 
      error: 'Failed to generate coaching advice',
      details: error.message 
    }, { status: 500 });
  }
}
