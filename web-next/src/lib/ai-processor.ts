// web-next/src/lib/ai-processor.ts
// Centralized AI processing service for batch operations

import OpenAI from 'openai';
import { MemberChange, ChangeSummary } from './snapshots';
import { calculatePlayerDNA, calculateClanDNA, classifyPlayerArchetype } from './player-dna';

export interface AICoachingAdvice {
  category: string;
  title: string;
  description: string;
  chatMessage: string;
  priority: 'high' | 'medium' | 'low';
  icon: string;
  timestamp?: string;
  date?: string;
}

export interface AISummaryAnalysis {
  type: 'change_summary' | 'full_analysis' | 'performance_review';
  content: string;
  insights: string[];
  recommendations: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface PlayerDNAInsights {
  playerTag: string;
  playerName: string;
  archetype: string;
  strengths: string[];
  improvementAreas: string[];
  coachingTips: string[];
  personality: string;
}

export interface ClanDNAInsights {
  overallHealth: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  topPerformers: string[];
  needsAttention: string[];
}

export interface BatchAIResults {
  timestamp: string;
  clanTag: string;
  date?: string;
  changeSummary?: AISummaryAnalysis;
  coachingAdvice?: AICoachingAdvice[];
  playerDNAInsights?: PlayerDNAInsights[];
  clanDNAInsights?: ClanDNAInsights;
  gameChatMessages?: string[];
  performanceAnalysis?: AISummaryAnalysis;
  snapshotSummary?: string;
  error?: string;
}

export class AIProcessor {
  private openai: OpenAI | null = null;
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!process.env.OPENAI_API_KEY;
    if (this.isConfigured) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async processBatchAI(
    clanData: any,
    changes: MemberChange[],
    clanTag: string,
    date: string
  ): Promise<BatchAIResults> {
    const startTime = Date.now();
    console.log(`[AI] Starting batch processing for ${clanTag} at ${new Date().toISOString()}`);

    const results: BatchAIResults = {
      timestamp: new Date().toISOString(),
      clanTag,
      date,
    };

    if (!this.isConfigured) {
      results.error = 'OpenAI API key not configured';
      console.log('[AI] OpenAI API key not configured, skipping AI processing');
      return results;
    }

    try {
      // Process all AI functions in parallel for maximum efficiency
      const [
        changeSummary,
        coachingAdvice,
        playerDNAInsights,
        clanDNAInsights,
        gameChatMessages,
        performanceAnalysis
      ] = await Promise.allSettled([
        this.generateChangeSummary(changes, clanTag, date),
        this.generateCoachingAdvice(clanData),
        this.generatePlayerDNAInsights(clanData),
        this.generateClanDNAInsights(clanData),
        this.generateGameChatMessages(changes),
        this.generatePerformanceAnalysis(clanData)
      ]);

      // Process results and handle any failures gracefully
      if (changeSummary.status === 'fulfilled') {
        results.changeSummary = changeSummary.value;
      }
      if (coachingAdvice.status === 'fulfilled') {
        results.coachingAdvice = coachingAdvice.value;
      }
      if (playerDNAInsights.status === 'fulfilled') {
        results.playerDNAInsights = playerDNAInsights.value;
      }
      if (clanDNAInsights.status === 'fulfilled') {
        results.clanDNAInsights = clanDNAInsights.value;
      }
      if (gameChatMessages.status === 'fulfilled') {
        results.gameChatMessages = gameChatMessages.value;
      }
      if (performanceAnalysis.status === 'fulfilled') {
        results.performanceAnalysis = performanceAnalysis.value;
      }

      const processingTime = Date.now() - startTime;
      console.log(`[AI] Batch processing completed in ${processingTime}ms for ${clanTag}`);

      return results;
    } catch (error: any) {
      console.error(`[AI] Batch processing error for ${clanTag}:`, error);
      results.error = error.message;
      return results;
    }
  }

  private async generateChangeSummary(
    changes: MemberChange[],
    clanTag: string,
    date: string
  ): Promise<AISummaryAnalysis> {
    if (changes.length === 0) {
      return {
        type: 'change_summary',
        content: "No significant changes detected in the clan today.",
        insights: [],
        recommendations: [],
        priority: 'low'
      };
    }

    const prompt = this.buildChangeSummaryPrompt(changes, clanTag, date);
    
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that summarizes Clash of Clans clan activity in a concise, engaging way. Focus on the most important changes and present them in a friendly, clan-leader tone."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "No changes to report.";

    return {
      type: 'change_summary',
      content,
      insights: this.extractInsights(content),
      recommendations: this.extractRecommendations(content),
      priority: changes.length > 10 ? 'high' : 'medium'
    };
  }

  private async generateCoachingAdvice(clanData: any): Promise<AICoachingAdvice[]> {
    const members = clanData.members;
    const totalDonations = members.reduce((sum: number, m: any) => sum + (m.donations || 0), 0);
    const avgDonations = totalDonations / members.length;
    
    // Calculate rush percentages and contextual data (same as enhanced manual generation)
    const thCaps = this.calculateThCaps(members);
    const membersWithContext = members.map((member: any) => {
      const rushPercentage = this.calculateRushPercentage(member, thCaps);
      const donationBalance = (member.donationsReceived || 0) - (member.donations || 0);
      const isNetReceiver = donationBalance > 0;
      const isLowDonator = (member.donations || 0) < avgDonations * 0.5;
      
      return {
        ...member,
        rushPercentage,
        isRushed: rushPercentage > 50,
        isVeryRushed: rushPercentage > 70,
        donationBalance,
        isNetReceiver,
        isLowDonator
      };
    });
    
    const topDonators = membersWithContext.sort((a: any, b: any) => (b.donations || 0) - (a.donations || 0)).slice(0, 3);
    const lowDonators = membersWithContext.filter((m: any) => (m.donations || 0) < avgDonations * 0.5);
    const inactiveMembers = membersWithContext.filter((m: any) => typeof m.lastSeen === "number" && m.lastSeen > 3);
    const newMembers = membersWithContext.filter((m: any) => (m.tenure || 0) < 7);
    const highTrophyMembers = membersWithContext.filter((m: any) => (m.trophies || 0) > 2000);
    const lowTrophyMembers = membersWithContext.filter((m: any) => (m.trophies || 0) < 1000);
    const rushedMembers = membersWithContext.filter((m: any) => m.isRushed);
    const veryRushedMembers = membersWithContext.filter((m: any) => m.isVeryRushed);

    const prompt = `You are an expert Clash of Clans clan leader. Analyze this SPECIFIC clan data and provide personalized coaching advice based on what's actually happening RIGHT NOW.

CLAN: ${clanData.clanName} (${clanData.clanTag})
- Total Members: ${clanData.memberCount}
- Average Town Hall Level: ${clanData.averageTownHall}
- Average Trophies: ${clanData.averageTrophies}
- Total Donations: ${totalDonations}
- Average Donations: ${avgDonations.toFixed(1)}

MEMBER ANALYSIS (with contextual insights):
${membersWithContext.map((member: any) => `
${member.name} (${member.tag})
- Role: ${member.role} | TH: ${member.townHall || member.townHallLevel} | Trophies: ${member.trophies}
- Donations: ${member.donations} given, ${member.donationsReceived} received (Balance: ${member.donationBalance > 0 ? '+' : ''}${member.donationBalance})
- Tenure: ${member.tenure || member.tenure_days} days | Last Seen: ${member.lastSeen} days ago
- Rush Percentage: ${member.rushPercentage}% ${member.isVeryRushed ? '(VERY RUSHED!)' : member.isRushed ? '(rushed)' : '(good)'}
- Heroes: BK:${member.bk || 'N/A'} AQ:${member.aq || 'N/A'} GW:${member.gw || 'N/A'} RC:${member.rc || 'N/A'} MP:${member.mp || 'N/A'}
- Context: ${member.isNetReceiver ? 'Net receiver' : 'Net giver'}${member.isLowDonator ? ', Low donator' : ''}
`).join('')}

KEY INSIGHTS:
- Top donators: ${topDonators.map((m: any) => `${m.name} (${m.donations})`).join(', ')}
- Low donators: ${lowDonators.map((m: any) => `${m.name} (${m.donations})`).join(', ')}
- Inactive members: ${inactiveMembers.map((m: any) => `${m.name} (${m.lastSeen} days)`).join(', ')}
- New members: ${newMembers.map((m: any) => `${m.name} (${m.tenure} days)`).join(', ')}
- High trophy members (>2000): ${highTrophyMembers.map((m: any) => m.name).join(', ')}
- Low trophy members (<1000): ${lowTrophyMembers.map((m: any) => m.name).join(', ')}
- Rushed members (50%+): ${rushedMembers.map((m: any) => `${m.name} (${m.rushPercentage}%)`).join(', ')}
- Very rushed members (70%+): ${veryRushedMembers.map((m: any) => `${m.name} (${m.rushPercentage}%)`).join(', ')}

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

Make messages PERSONAL and SPECIFIC. Use actual player names. Mention specific numbers and achievements.

IMPORTANT: Be contextually aware! If a player is upgrading heroes but has a high rush percentage (70%+), acknowledge BOTH the progress AND the underlying rush problem. Don't just celebrate hero upgrades without considering the bigger picture.`;

    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
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

    try {
      const advice = JSON.parse(content);
      // Add timestamps to all advice items
      const timestamp = new Date().toISOString();
      const date = (() => {
        try {
          return new Date().toLocaleDateString();
        } catch (error) {
          console.error('Date formatting error in ai-processor:', error);
          return 'Unknown Date';
        }
      })();
      
      return advice.map((item: AICoachingAdvice) => ({
        ...item,
        timestamp,
        date
      }));
    } catch (error) {
      console.error('Failed to parse coaching advice JSON:', error);
      return [{
        category: "System Error",
        title: "AI Processing Error",
        description: "Failed to generate personalized coaching advice. Please try again later.",
        chatMessage: "AI coaching temporarily unavailable. Manual review recommended.",
        priority: "low" as const,
        icon: "⚠️",
        timestamp: new Date().toISOString(),
        date: (() => {
          try {
            return new Date().toLocaleDateString();
          } catch (error) {
            console.error('Date formatting error in ai-processor fallback:', error);
            return 'Unknown Date';
          }
        })()
      }];
    }
  }

  private async generatePlayerDNAInsights(clanData: any): Promise<PlayerDNAInsights[]> {
    const insights: PlayerDNAInsights[] = [];
    
    for (const member of clanData.members) {
      try {
        // Calculate DNA for this player
        const dna = calculatePlayerDNA(member, clanData);
        
        const prompt = `Analyze this Clash of Clans player's DNA profile and provide personalized insights:

PLAYER: ${member.name} (${member.tag})
- Role: ${member.role}
- Town Hall Level: ${member.townHallLevel}
- Trophies: ${member.trophies}
- Donations: ${member.donations} given, ${member.donationsReceived} received
- War Stars: ${member.warStars || 0}
- Capital Contributions: ${member.capitalContributions || 0}
- Tenure: ${member.tenure || 0} days

DNA PROFILE:
- Leadership: ${dna.leadership}/10
- Performance: ${dna.performance}/10
- Generosity: ${dna.generosity}/10
- Social: ${dna.social}/10
- Specialization: ${dna.specialization}/10
- Consistency: ${dna.consistency}/10

Provide personalized insights including:
1. Player's key strengths (2-3 items)
2. Areas for improvement (2-3 items)
3. Specific coaching tips (2-3 actionable items)
4. Personality assessment (brief description)

Format as JSON:
{
  "strengths": ["strength1", "strength2", "strength3"],
  "improvementAreas": ["area1", "area2", "area3"],
  "coachingTips": ["tip1", "tip2", "tip3"],
  "personality": "brief personality description"
}`;

        if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are an expert Clash of Clans coach. Provide personalized, actionable insights for each player. Always return valid JSON."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 400,
          temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          insights.push({
            playerTag: member.tag,
            playerName: member.name,
            archetype: classifyPlayerArchetype(dna, member),
            ...parsed
          });
        }
      } catch (error) {
        console.error(`Failed to generate DNA insights for ${member.name}:`, error);
        // Continue with other players
      }
    }

    return insights;
  }

  private async generateClanDNAInsights(clanData: any): Promise<ClanDNAInsights> {
    const clanDNA = calculateClanDNA(clanData.members);
    
    const prompt = `Analyze this Clash of Clans clan's overall DNA profile and provide strategic insights:

CLAN: ${clanData.clanName} (${clanData.clanTag})
- Total Members: ${clanData.memberCount}
- Average Town Hall Level: ${clanData.averageTownHall}
- Average Trophies: ${clanData.averageTrophies}

CLAN DNA PROFILE:
- Leadership: ${clanDNA.averageDNA.leadership}/10
- Performance: ${clanDNA.averageDNA.performance}/10
- Generosity: ${clanDNA.averageDNA.generosity}/10
- Social: ${clanDNA.averageDNA.social}/10
- Specialization: ${clanDNA.averageDNA.specialization}/10
- Consistency: ${clanDNA.averageDNA.consistency}/10

ARCHETYPE DISTRIBUTION:
${Object.entries(clanDNA.archetypeDistribution).map(([archetype, count]) => `- ${archetype}: ${count} members`).join('\n')}

Provide strategic insights including:
1. Overall clan health score (0-100)
2. Key strengths (3-4 items)
3. Key weaknesses (3-4 items)
4. Strategic recommendations (3-4 actionable items)
5. Top performers (3-5 player names)
6. Members needing attention (3-5 player names)

Format as JSON:
{
  "overallHealth": 85,
  "strengths": ["strength1", "strength2", "strength3", "strength4"],
  "weaknesses": ["weakness1", "weakness2", "weakness3", "weakness4"],
  "recommendations": ["rec1", "rec2", "rec3", "rec4"],
  "topPerformers": ["player1", "player2", "player3", "player4", "player5"],
  "needsAttention": ["player1", "player2", "player3", "player4", "player5"]
}`;

    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a strategic Clash of Clans clan advisor. Provide comprehensive clan-level insights and recommendations. Always return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }

    return {
      overallHealth: 50,
      strengths: ["Analysis pending"],
      weaknesses: ["Analysis pending"],
      recommendations: ["Analysis pending"],
      topPerformers: [],
      needsAttention: []
    };
  }

  private async generateGameChatMessages(changes: MemberChange[]): Promise<string[]> {
    const messages: string[] = [];
    
    for (const change of changes) {
      if (change.type === 'hero_upgrade') {
        const hero = (change as any).hero;
        const level = (change as any).newLevel;
        const player = change.member.name;
        
        let emoji = "💪";
        if (level >= 50) emoji = "⚡";
        if (level >= 70) emoji = "🔥";
        
        messages.push(`${emoji} ${player} upgraded their ${hero} to level ${level}! ${level >= 50 ? "Great progress!" : "Keep it up!"} ${level >= 70 ? "🚀" : "🎯"}`);
      } else if (change.type === 'town_hall_upgrade') {
        const level = (change as any).newLevel;
        const player = change.member.name;
        messages.push(`🏰 ${player} upgraded to Town Hall ${level}! Welcome to the next level! 🎊`);
      } else if (change.type === 'trophy_change') {
        const changeAmount = (change as any).changeAmount;
        const newTrophies = (change as any).newTrophies;
        const oldTrophies = newTrophies - changeAmount;
        const player = change.member.name;
        
        if (changeAmount > 0) {
          messages.push(`📈 ${player} just pushed ${changeAmount} trophies! From ${oldTrophies} to ${newTrophies}! 🚀`);
        }
      } else if (change.type === 'donation_change') {
        const changeAmount = (change as any).changeAmount;
        const player = change.member.name;
        
        if (changeAmount > 100) {
          messages.push(`💝 ${player} donated ${changeAmount} troops today! You're a donation machine! 🏆`);
        }
      } else if (change.type === 'role_change') {
        const newRole = (change as any).newRole;
        const player = change.member.name;
        
        if (newRole === 'coLeader') {
          messages.push(`💎 Congratulations ${player} on becoming Co-Leader! Well deserved! 🎊`);
        } else if (newRole === 'elder') {
          messages.push(`⭐ Congratulations ${player} on becoming elder! Well deserved! 🎊`);
        }
      }
    }
    
    return messages;
  }

  private async generatePerformanceAnalysis(clanData: any): Promise<AISummaryAnalysis> {
    const prompt = `Analyze this Clash of Clans clan data and provide a comprehensive performance summary:

CLAN OVERVIEW:
- Name: ${clanData.clanName} (${clanData.clanTag})
- Total Members: ${clanData.memberCount}
- Average Town Hall Level: ${clanData.averageTownHall}
- Average Trophies: ${clanData.averageTrophies}
- Total Donations: ${clanData.totalDonations}

MEMBER ANALYSIS:
${clanData.members.map((member: any) => `
${member.name} (${member.tag})
- Role: ${member.role}
- Town Hall: ${member.townHallLevel}
- Trophies: ${member.trophies}
- Donations: ${member.donations} given, ${member.donationsReceived} received
- Tenure: ${member.tenure || 0} days
- Last Seen: ${member.lastSeen || 0} days ago
`).join('')}

Please provide a comprehensive analysis covering:
1. Overall clan health and activity levels
2. Member progression and development patterns
3. Donation patterns and clan support
4. Potential areas for improvement
5. Member retention and engagement insights
6. Notable achievements or concerns
7. Recommendations for clan management

Format your response as a clear, actionable summary that would be useful for clan leadership.`;

    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that provides comprehensive analysis of Clash of Clans clan data. Provide detailed, actionable insights for clan leadership."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "Analysis pending.";

    return {
      type: 'performance_review',
      content,
      insights: this.extractInsights(content),
      recommendations: this.extractRecommendations(content),
      priority: 'medium'
    };
  }

  private buildChangeSummaryPrompt(changes: MemberChange[], clanTag: string, date: string): string {
    const changeTypes = changes.reduce((acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const significantChanges = changes.filter(c => 
      c.type === 'town_hall_upgrade' || 
      c.type === 'hero_upgrade' || 
      c.type === 'trophy_change' ||
      c.type === 'role_change'
    );

    return `Clan ${clanTag} activity summary for ${date}:

CHANGE OVERVIEW:
${Object.entries(changeTypes).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

SIGNIFICANT CHANGES:
${significantChanges.map(change => {
      const member = change.member.name;
      switch (change.type) {
        case 'town_hall_upgrade':
          return `- ${member} upgraded to Town Hall ${(change as any).newLevel}`;
        case 'hero_upgrade':
          return `- ${member} upgraded ${(change as any).hero} to level ${(change as any).newLevel}`;
        case 'trophy_change':
          const changeAmount = (change as any).changeAmount;
          return `- ${member} ${changeAmount > 0 ? 'gained' : 'lost'} ${Math.abs(changeAmount)} trophies`;
        case 'role_change':
          return `- ${member} became ${(change as any).newRole}`;
        default:
          return `- ${member}: ${change.type}`;
      }
    }).join('\n')}

Provide an engaging, concise summary highlighting the most important changes and achievements.`;
  }

  private extractInsights(content: string): string[] {
    // Simple extraction of insights from AI content
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 3).map(s => s.trim());
  }

  private extractRecommendations(content: string): string[] {
    // Simple extraction of recommendations from AI content
    const sentences = content.split(/[.!?]+/).filter(s => 
      s.trim().length > 10 && 
      (s.toLowerCase().includes('recommend') || 
       s.toLowerCase().includes('should') || 
       s.toLowerCase().includes('consider'))
    );
    return sentences.slice(0, 3).map(s => s.trim());
  }

  // Rush percentage calculation methods (same as enhanced manual generation)
  private getTH(m: any): number {
    return m.townHallLevel ?? m.townHall ?? m.th ?? 0;
  }

  private calculateRushPercentage(m: any, thCaps: Map<number, any>): number {
    const th = this.getTH(m) ?? 0; 
    const caps = thCaps?.get(th) || {};
    const keys: ("bk"|"aq"|"gw"|"rc"|"mp")[] = []; 
    for (const k of ["bk", "aq", "gw", "rc", "mp"] as const) {
      if (caps[k] && caps[k]! > 0) keys.push(k);
    }
    if (keys.length === 0) return 0;
    let total = 0;
    for (const k of keys) {
      const current = (m[k] ?? 0);
      const cap = caps[k]!;
      total += Math.max(0, cap - current) / cap;
    }
    return Math.round((total / keys.length) * 100);
  }

  private calculateThCaps(members: any[]): Map<number, any> {
    const caps = new Map<number, any>();
    for (const m of members) {
      const th = this.getTH(m); 
      if (th < 8) continue;
      const entry = caps.get(th) || {};
      for (const k of ["bk", "aq", "gw", "rc", "mp"] as const) {
        const v = m[k];
        if (typeof v === "number" && v > 0) {
          entry[k] = Math.max(entry[k] || 0, v);
        }
      }
      caps.set(th, entry);
    }
    return caps;
  }
}

// Export singleton instance
export const aiProcessor = new AIProcessor();
