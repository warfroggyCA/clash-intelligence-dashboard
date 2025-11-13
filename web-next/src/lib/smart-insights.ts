// web-next/src/lib/smart-insights.ts
// Centralized insights processing service for automated summaries and coaching

import OpenAI from 'openai';
import { MemberChange, ChangeSummary } from './snapshots';
import { calculatePlayerDNA, calculateClanDNA, classifyPlayerArchetype } from './player-dna';
import { groupMemberChanges, formatAggregatedChange, type AggregatedChange } from './insights-utils';

export const SMART_INSIGHTS_SCHEMA_VERSION = '2.0.0';

export type SmartInsightsSource = 'nightly_cron' | 'manual_refresh' | 'adhoc' | 'unknown';

export interface SmartInsightsMetadata {
  clanTag: string;
  snapshotDate: string;
  generatedAt: string;
  source: SmartInsightsSource;
  schemaVersion: string;
  snapshotId?: string;
}

export interface SmartInsightsHeadline {
  id: string;
  title: string;
  detail?: string;
  priority: 'high' | 'medium' | 'low';
  category: 'change' | 'performance' | 'war' | 'donation' | 'spotlight';
}

export interface SmartInsightsRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  icon?: string;
  chatMessage?: string;
}

export interface SmartInsightsPlayerSpotlight {
  id: string;
  playerTag: string;
  playerName: string;
  archetype: string;
  headline: string;
  strengths: string[];
  improvementAreas: string[];
  coachingTips: string[];
}

export interface SmartInsightsPlayerOfDay {
  playerTag: string;
  playerName: string;
  score: number;
  highlights: string[];
}

export interface SmartInsightsDiagnostics {
  openAIConfigured: boolean;
  processingTimeMs: number;
  hasError: boolean;
  changeSummary: boolean;
  coaching: boolean;
  playerDNA: boolean;
  clanDNA: boolean;
  gameChat: boolean;
  performanceAnalysis: boolean;
  errorMessage?: string;
}

export type SmartInsightsSentiment = 'positive' | 'neutral' | 'warning';

export interface SmartInsightsBriefingMetric {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
}

export interface SmartInsightsBriefingHighlight {
  id: string;
  headline: string;
  detail?: string;
  priority: 'high' | 'medium' | 'low';
  category: 'change' | 'performance' | 'war' | 'donation' | 'spotlight' | 'intel' | 'warning';
  tags?: string[];
  metric?: SmartInsightsBriefingMetric;
}

export interface SmartInsightsBriefing {
  title: string;
  summary: string;
  sentiment: SmartInsightsSentiment;
  highlights: SmartInsightsBriefingHighlight[];
}

export type SmartInsightsRecognitionEmphasis = 'celebrate' | 'watch' | 'warn';

export interface SmartInsightsRecognitionEntry {
  id: string;
  playerTag: string;
  playerName: string;
  headline: string;
  reason: string;
  emphasis: SmartInsightsRecognitionEmphasis;
  metricValue?: string;
  metricDelta?: string;
  tags?: string[];
}

export interface SmartInsightsRecognition {
  playerOfTheDay?: SmartInsightsPlayerOfDay | null;
  spotlights: SmartInsightsRecognitionEntry[];
  watchlist: SmartInsightsRecognitionEntry[];
  callouts: SmartInsightsRecognitionEntry[];
}

export interface SmartInsightsContext {
  changeSummary?: SnapshotSummaryAnalysis;
  performanceAnalysis?: SnapshotSummaryAnalysis;
  clanDNAInsights?: ClanDNAInsights;
  gameChatMessages?: string[];
}

export interface SmartInsightsPayload {
  metadata: SmartInsightsMetadata;
  briefing: SmartInsightsBriefing;
  headlines: SmartInsightsHeadline[];
  recognition: SmartInsightsRecognition;
  coaching: SmartInsightsRecommendation[];
  playerSpotlights: SmartInsightsPlayerSpotlight[];
  playerOfTheDay?: SmartInsightsPlayerOfDay | null;
  diagnostics: SmartInsightsDiagnostics;
  context: SmartInsightsContext;
}

export interface SmartInsightsBuildOptions {
  source?: SmartInsightsSource;
  snapshotId?: string;
}

export interface CoachingInsight {
  category: string;
  title: string;
  description: string;
  chatMessage: string;
  priority: 'high' | 'medium' | 'low';
  icon: string;
  timestamp?: string;
  date?: string;
}

export interface SnapshotSummaryAnalysis {
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

export interface InsightsBundle {
  timestamp: string;
  clanTag: string;
  date?: string;
  changes?: MemberChange[];
  changeSummary?: SnapshotSummaryAnalysis;
  coachingInsights?: CoachingInsight[];
  playerDNAInsights?: PlayerDNAInsights[];
  clanDNAInsights?: ClanDNAInsights;
  gameChatMessages?: string[];
  performanceAnalysis?: SnapshotSummaryAnalysis;
  snapshotSummary?: string;
  error?: string;
  smartInsightsPayload?: SmartInsightsPayload;
}

export class InsightsEngine {
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

  private parseJsonResponse<T>(raw: string, options: { expectArray: boolean; context: string }): T {
    const { expectArray, context } = options;
    const trimmed = raw?.trim?.() ?? '';

    if (!trimmed) {
      throw new Error(`Empty response for ${context}`);
    }

    const attempts = new Set<string>();
    attempts.add(trimmed);

    const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeFenceMatch) {
      attempts.add(codeFenceMatch[1].trim());
    }

    const bracketOpen = expectArray ? '[' : '{';
    const bracketClose = expectArray ? ']' : '}';

    const addSlicedAttempt = (candidate: string) => {
      const start = candidate.indexOf(bracketOpen);
      const end = candidate.lastIndexOf(bracketClose);
      if (start !== -1 && end !== -1 && end > start) {
        const sliced = candidate.slice(start, end + 1).trim();
        if (sliced) {
          attempts.add(sliced);
        }
      }
    };

    Array.from(attempts).forEach(addSlicedAttempt);

    for (const attempt of attempts) {
      try {
        const parsed = JSON.parse(attempt);
        const isArray = Array.isArray(parsed);
        if (expectArray ? isArray : !isArray) {
          return parsed as T;
        }
      } catch (error) {
        // try the next attempt
      }
    }

    console.error(`Failed to parse JSON for ${context}. Raw response:`, raw);
    throw new Error(`Unable to parse JSON for ${context}`);
  }

  async processBundle(
    clanData: any,
    changes: MemberChange[],
    clanTag: string,
    date: string,
    options: SmartInsightsBuildOptions = {}
  ): Promise<InsightsBundle> {
    const startTime = Date.now();
    console.log(`[Insights] Starting batch processing for ${clanTag} at ${new Date().toISOString()}`);

    const results: InsightsBundle = {
      timestamp: new Date().toISOString(),
      clanTag,
      date,
      changes,
    };

    const playerOfTheDay = calculatePlayerOfTheDay(changes);

    if (!this.isConfigured) {
      results.error = 'Insights engine not configured';
      console.log('[Insights] OpenAI API key not configured, skipping automated insights');
      const processingTime = Date.now() - startTime;
      results.smartInsightsPayload = composeSmartInsightsPayload({
        bundle: results,
        clanTag,
        snapshotDate: date,
        processingTimeMs: processingTime,
        source: options.source || 'unknown',
        snapshotId: options.snapshotId,
        openAIConfigured: this.isConfigured,
        playerOfTheDay,
        roster: clanData,
      });
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
        results.coachingInsights = coachingAdvice.value;
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
      console.log(`[Insights] Batch processing completed in ${processingTime}ms for ${clanTag}`);
      results.smartInsightsPayload = composeSmartInsightsPayload({
        bundle: results,
        clanTag,
        snapshotDate: date,
        processingTimeMs: processingTime,
        source: options.source || 'unknown',
        snapshotId: options.snapshotId,
        openAIConfigured: this.isConfigured,
        playerOfTheDay,
        roster: clanData,
      });

      return results;
    } catch (error: any) {
      console.error(`[Insights] Batch processing error for ${clanTag}:`, error);
      results.error = error.message;
      const processingTime = Date.now() - startTime;
      results.smartInsightsPayload = composeSmartInsightsPayload({
        bundle: results,
        clanTag,
        snapshotDate: date,
        processingTimeMs: processingTime,
        source: options.source || 'unknown',
        snapshotId: options.snapshotId,
        openAIConfigured: this.isConfigured,
        playerOfTheDay,
        roster: clanData,
      });
      return results;
    }
  }

  private async generateChangeSummary(
    changes: MemberChange[],
    clanTag: string,
    date: string
  ): Promise<SnapshotSummaryAnalysis> {
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
          content: "You are a helpful assistant that summarizes Clash of Clans clan activity in a concise, engaging way. Focus on the most important changes and present them in a friendly, clan-leader tone. NEVER include 'undefined', 'NaN', or placeholder values in your response. Only mention players and values that are explicitly provided in the data."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    let content = response.choices[0]?.message?.content || "No changes to report.";
    
    // Sanitize AI output to remove any undefined/NaN values that might have slipped through
    content = this.sanitizeAIContent(content);

    return {
      type: 'change_summary',
      content,
      insights: this.extractInsights(content),
      recommendations: this.extractRecommendations(content),
      priority: changes.length > 10 ? 'high' : 'medium'
    };
  }

  private async generateCoachingAdvice(clanData: any): Promise<CoachingInsight[]> {
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
- Heroes: BK:${member.bk || 'N/A'} AQ:${member.aq || 'N/A'} MP:${member.mp || 'N/A'} GW:${member.gw || 'N/A'} RC:${member.rc || 'N/A'}
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
      const advice = this.parseJsonResponse<CoachingInsight[]>(content, {
        expectArray: true,
        context: 'coaching insights payload'
      });
      // Add timestamps to all advice items
      const timestamp = new Date().toISOString();
      const date = (() => {
        try {
          return new Date().toISOString().slice(0, 10); // Use ISO format for consistency
        } catch (error) {
          console.error('Date formatting error in smart-insights:', error);
          return 'Unknown Date';
        }
      })();
      
      return advice.map((item: CoachingInsight) => ({
        ...item,
        timestamp,
        date
      }));
    } catch (error) {
      console.error('Failed to parse coaching advice JSON:', error);
      return [{
        category: "System Error",
        title: "Insights Processing Error",
        description: "Failed to generate personalized coaching insights. Please try again later.",
        chatMessage: "Automated coaching temporarily unavailable. Manual review recommended.",
        priority: "low" as const,
        icon: "⚠️",
        timestamp: new Date().toISOString(),
        date: (() => {
          try {
            return new Date().toISOString().slice(0, 10); // Use ISO format for consistency
          } catch (error) {
            console.error('Date formatting error in smart-insights fallback:', error);
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
          const parsed = this.parseJsonResponse<PlayerDNAInsights>(content, {
            expectArray: false,
            context: `Player DNA insights for ${member.name}`
          });
          insights.push(parsed);
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
      return this.parseJsonResponse<ClanDNAInsights>(content, {
        expectArray: false,
        context: 'Clan DNA insights'
      });
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
    
    // Helper to extract hero name from description (same as ai-summarizer.ts)
    const getHeroDisplayName = (description: string): string => {
      if (description.includes('BK') || description.includes('Barbarian King')) return 'Barbarian King';
      if (description.includes('AQ') || description.includes('Archer Queen')) return 'Archer Queen';
      if (description.includes('GW') || description.includes('Grand Warden')) return 'Grand Warden';
      if (description.includes('RC') || description.includes('Royal Champion')) return 'Royal Champion';
      if (description.includes('MP') || description.includes('Minion Prince')) return 'Minion Prince';
      // Fallback: try to extract from description
      const match = description.match(/(\w+(?:\s+\w+)?)/i);
      return match ? match[1] : 'Hero';
    };
    
    for (const change of changes) {
      if (change.type === 'hero_upgrade') {
        // FIX: Use description and newValue instead of non-existent hero/newLevel properties
        const hero = getHeroDisplayName(change.description);
        const level = Number(change.newValue) || 0;
        const player = change.member.name;
        
        if (!hero || !level || level === 0) {
          // Skip invalid hero upgrades
          continue;
        }
        
        let emoji = "💪";
        if (level >= 50) emoji = "⚡";
        if (level >= 70) emoji = "🔥";
        
        messages.push(`${emoji} ${player} upgraded their ${hero} to level ${level}! ${level >= 50 ? "Great progress!" : "Keep it up!"} ${level >= 70 ? "🚀" : "🎯"}`);
      } else if (change.type === 'town_hall_upgrade') {
        // FIX: Use newValue instead of newLevel
        const level = Number(change.newValue) || 0;
        const player = change.member.name;
        
        if (level > 0) {
          messages.push(`🏰 ${player} upgraded to Town Hall ${level}! Welcome to the next level! 🎊`);
        }
      } else if (change.type === 'trophy_change') {
        // FIX: Use newValue and previousValue instead of changeAmount/newTrophies
        const newTrophies = Number(change.newValue) || 0;
        const oldTrophies = Number(change.previousValue) || 0;
        const changeAmount = newTrophies - oldTrophies;
        const player = change.member.name;
        
        if (changeAmount >= 100) {
          messages.push(`📈 ${player} just pushed ${changeAmount} trophies! From ${oldTrophies} to ${newTrophies}! 🚀`);
        }
      } else if (change.type === 'donation_change') {
        // FIX: Use newValue and previousValue instead of changeAmount
        const newDonations = Number(change.newValue) || 0;
        const oldDonations = Number(change.previousValue) || 0;
        const changeAmount = newDonations - oldDonations;
        const player = change.member.name;
        
        if (changeAmount >= 500) {
          messages.push(`💝 ${player} donated ${changeAmount} troops today! You're a donation machine! 🏆`);
        }
      } else if (change.type === 'role_change') {
        // FIX: Use newValue instead of newRole
        const newRole = change.newValue;
        const player = change.member.name;
        
        if (newRole === 'coLeader' || newRole === 'co-leader') {
          messages.push(`💎 Congratulations ${player} on becoming Co-Leader! Well deserved! 🎊`);
        } else if (newRole === 'elder') {
          messages.push(`⭐ Congratulations ${player} on becoming Elder! Well deserved! 🎊`);
        }
      }
    }
    
    return messages;
  }

  private async generatePerformanceAnalysis(clanData: any): Promise<SnapshotSummaryAnalysis> {
    // Filter out invalid members (missing names, invalid data)
    const validMembers = (clanData.members || []).filter((member: any) => {
      return member?.name && typeof member.name === 'string' && member.name.trim().length > 0;
    });

    // Helper to safely format values
    const safeValue = (value: any, fallback: string | null | undefined = 'N/A'): string | null => {
      if (value === null || value === undefined) return fallback === null ? null : (fallback ?? 'N/A');
      if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) return fallback === null ? null : (fallback ?? 'N/A');
      return String(value);
    };

    const prompt = `Analyze this Clash of Clans clan data and provide a comprehensive performance summary:

CLAN OVERVIEW:
- Name: ${safeValue(clanData.clanName, 'Unknown Clan')} (${safeValue(clanData.clanTag, 'Unknown')})
- Total Members: ${validMembers.length}
- Average Town Hall Level: ${safeValue(clanData.averageTownHall, 'N/A')}
- Average Trophies: ${safeValue(clanData.averageTrophies, 'N/A')}
- Total Donations: ${safeValue(clanData.totalDonations, '0')}

MEMBER ANALYSIS:
${validMembers.map((member: any) => `
${safeValue(member.name, 'Unknown Member')} (${safeValue(member.tag, 'Unknown')})
- Role: ${safeValue(member.role, 'member')}
- Town Hall: ${safeValue(member.townHallLevel || member.townHall || member.th, 'N/A')}
- Trophies: ${safeValue(member.trophies, '0')}
- Donations: ${safeValue(member.donations, '0')} given, ${safeValue(member.donationsReceived, '0')} received
- Tenure: ${safeValue(member.tenure || member.tenure_days, '0')} days
- Last Seen: ${safeValue(member.lastSeen, '0')} days ago
`).join('')}

Please provide a comprehensive analysis covering:
1. Overall clan health and activity levels
2. Member progression and development patterns
3. Donation patterns and clan support
4. Potential areas for improvement
5. Member retention and engagement insights
6. Notable achievements or concerns
7. Recommendations for clan management

Format your response as a clear, actionable summary that would be useful for clan leadership.
IMPORTANT: Only mention players and values that are explicitly listed above. Do not include "undefined", "NaN", or any placeholder values.`;

    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that provides comprehensive analysis of Clash of Clans clan data. Provide detailed, actionable insights for clan leadership. NEVER include 'undefined', 'NaN', or placeholder values in your response."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    let content = response.choices[0]?.message?.content || "Analysis pending.";
    
    // Sanitize AI output
    content = this.sanitizeAIContent(content);

    return {
      type: 'performance_review',
      content,
      insights: this.extractInsights(content),
      recommendations: this.extractRecommendations(content),
      priority: 'medium'
    };
  }

  private buildChangeSummaryPrompt(changes: MemberChange[], clanTag: string, date: string): string {
    // Filter out invalid changes: missing names or invalid data
    // NOTE: We include left_member changes as they are newsworthy
    const validChanges = changes.filter(c => {
      // Must have a valid member name
      if (!c.member?.name || typeof c.member.name !== 'string' || c.member.name.trim().length === 0) return false;
      return true;
    });

    if (validChanges.length === 0) {
      return `Clan ${clanTag} activity summary for ${date}:

No significant changes detected in the clan today.`;
    }

    const changeTypes = validChanges.reduce((acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Helper to safely format values, filtering out undefined/null/NaN
    const safeValue = (value: any, fallback: string | null | undefined = 'N/A'): string | null => {
      if (value === null || value === undefined) return fallback === null ? null : (fallback ?? 'N/A');
      if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) return fallback === null ? null : (fallback ?? 'N/A');
      return String(value);
    };

    const significantChanges = validChanges
      .filter(c => 
        c.type === 'town_hall_upgrade' || 
        c.type === 'hero_upgrade' || 
        c.type === 'trophy_change' ||
        c.type === 'role_change' ||
        c.type === 'new_member' ||
        c.type === 'left_member' ||
        c.type === 'donation_change'
      )
      .map(change => {
        const member = safeValue(change.member?.name, 'Unknown Member');
        
        switch (change.type) {
          case 'town_hall_upgrade': {
            const newLevel = safeValue((change as any).newLevel || change.newValue, null);
            if (newLevel === 'N/A' || newLevel === null) return null;
            return `- ${member} upgraded to Town Hall ${newLevel}`;
          }
          case 'hero_upgrade': {
            const hero = safeValue((change as any).hero, null);
            const newLevel = safeValue((change as any).newLevel || change.newValue, null);
            if (hero === 'N/A' || hero === null || newLevel === 'N/A' || newLevel === null) return null;
            return `- ${member} upgraded ${hero} to level ${newLevel}`;
          }
          case 'trophy_change': {
            const prevTrophies = typeof change.previousValue === 'number' ? change.previousValue : null;
            const newTrophies = typeof change.newValue === 'number' ? change.newValue : null;
            if (prevTrophies === null || newTrophies === null || isNaN(prevTrophies) || isNaN(newTrophies)) {
              // Try to extract from description
              const match = change.description?.match(/(-?\d+)/);
              if (match) {
                const delta = parseInt(match[0], 10);
                if (!isNaN(delta) && isFinite(delta)) {
                  return `- ${member} ${delta > 0 ? 'gained' : 'lost'} ${Math.abs(delta)} trophies`;
                }
              }
              return null;
            }
            const changeAmount = newTrophies - prevTrophies;
            if (changeAmount === 0) return null;
            return `- ${member} ${changeAmount > 0 ? 'gained' : 'lost'} ${Math.abs(changeAmount)} trophies (${prevTrophies} → ${newTrophies})`;
          }
          case 'role_change': {
            const newRole = safeValue((change as any).newRole || change.newValue, null);
            if (newRole === 'N/A' || newRole === null) return null;
            return `- ${member} became ${newRole}`;
          }
          case 'new_member':
            return `- ${member} joined the clan`;
          case 'left_member': {
            // Include departure news - format with available context if we have it
            const role = safeValue(change.member?.role, null);
            const townHall = safeValue(change.member?.townHallLevel || (change.member as any)?.townHall, null);
            const contextParts: string[] = [];
            if (role && role !== 'N/A' && role !== 'member') {
              contextParts.push(`former ${role}`);
            }
            if (townHall && townHall !== 'N/A') {
              contextParts.push(`TH${townHall}`);
            }
            const context = contextParts.length > 0 ? ` (${contextParts.join(', ')})` : '';
            return `- ${member} left the clan${context}`;
          }
          case 'donation_change': {
            const prevDonations = typeof change.previousValue === 'number' ? change.previousValue : null;
            const newDonations = typeof change.newValue === 'number' ? change.newValue : null;
            if (prevDonations === null || newDonations === null || isNaN(prevDonations) || isNaN(newDonations)) {
              return null;
            }
            const delta = newDonations - prevDonations;
            if (delta === 0) return null;
            return `- ${member} ${delta > 0 ? 'donated' : 'received'} ${Math.abs(delta)} troops`;
          }
          default:
            // Use description if available and valid
            if (change.description && !change.description.includes('undefined') && !change.description.includes('NaN')) {
              return `- ${member}: ${change.description}`;
            }
            return null;
        }
      })
      .filter((line): line is string => line !== null && line.length > 0);

    if (significantChanges.length === 0) {
      return `Clan ${clanTag} activity summary for ${date}:

Minor changes detected, but no significant updates to report.`;
    }

    return `Clan ${clanTag} activity summary for ${date}:

CHANGE OVERVIEW:
${Object.entries(changeTypes).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

SIGNIFICANT CHANGES:
${significantChanges.join('\n')}

Provide an engaging, concise summary (2-3 sentences) highlighting the most important changes and achievements. 
IMPORTANT: Only mention players and values that are explicitly listed above. Do not include "undefined", "NaN", or any placeholder values. 
If a value is missing, simply omit that detail rather than including a placeholder.`;
  }

  /**
   * Sanitize AI-generated content to remove undefined, NaN, and invalid placeholder values
   */
  private sanitizeAIContent(content: string): string {
    if (!content || typeof content !== 'string') return content;
    
    let sanitized = content;
    
    // Remove sentences containing "undefined" or "NaN" (case-insensitive)
    sanitized = sanitized
      .split(/[.!?]+/)
      .filter(sentence => {
        const lower = sentence.toLowerCase();
        return !lower.includes('undefined') && 
               !lower.includes('nan') && 
               !lower.match(/\bundefined\b/) &&
               !lower.match(/\bnan\b/) &&
               !lower.match(/leveled up an undefined/) &&
               !lower.match(/upgraded an undefined/) &&
               !lower.match(/to undefined/);
      })
      .join('. ')
      .trim();
    
    // Remove any remaining "undefined" or "NaN" strings and fix common patterns
    sanitized = sanitized
      .replace(/\bundefined\b/gi, '')
      .replace(/\bNaN\b/g, '')
      .replace(/reaching undefined level/gi, 'leveled up')
      .replace(/upgraded to undefined/gi, 'upgraded')
      .replace(/upgraded an undefined to undefined/gi, 'upgraded')
      .replace(/leveled up an undefined to undefined/gi, 'leveled up')
      .replace(/an undefined to undefined/gi, '')
      .replace(/undefined to undefined/gi, '')
      .replace(/lost NaN trophies/gi, 'experienced trophy changes')
      .replace(/gained NaN trophies/gi, 'experienced trophy changes')
      .replace(/undefined level/gi, 'a new level')
      .replace(/level undefined/gi, 'a new level')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\s*,\s*,/g, ',') // Remove double commas
      .replace(/\s*\.\s*\./g, '.') // Remove double periods
      .trim();
    
    // Remove sentences that are too short, incomplete, or contain invalid patterns
    sanitized = sanitized
      .split(/[.!?]+/)
      .filter(s => {
        const trimmed = s.trim();
        if (trimmed.length < 10) return false;
        if (trimmed.match(/^(also|additionally|furthermore|moreover),?\s*$/i)) return false;
        const lower = trimmed.toLowerCase();
        // Filter out sentences that still contain problematic patterns
        if (lower.includes('undefined') || lower.includes('nan')) return false;
        if (lower.match(/leveled up an?\s*$/)) return false; // Incomplete sentences
        if (lower.match(/upgraded an?\s*$/)) return false; // Incomplete sentences
        return true;
      })
      .join('. ')
      .trim();
    
    // Ensure proper sentence endings
    if (sanitized && !sanitized.match(/[.!?]$/)) {
      sanitized += '.';
    }
    
    return sanitized || "No significant changes detected in the clan today.";
  }

  private extractInsights(content: string): string[] {
    // Simple extraction of insights from AI content
    const sanitized = this.sanitizeAIContent(content);
    const sentences = sanitized.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 3).map(s => s.trim()).filter(s => !s.toLowerCase().includes('undefined') && !s.toLowerCase().includes('nan'));
  }

  private extractRecommendations(content: string): string[] {
    // Simple extraction of recommendations from AI content
    const sanitized = this.sanitizeAIContent(content);
    const sentences = sanitized.split(/[.!?]+/).filter(s => 
      s.trim().length > 10 && 
      (s.toLowerCase().includes('recommend') || 
       s.toLowerCase().includes('should') || 
       s.toLowerCase().includes('consider'))
    );
    return sentences.slice(0, 3)
      .map(s => s.trim())
      .filter(s => !s.toLowerCase().includes('undefined') && !s.toLowerCase().includes('nan'));
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

interface ContributionScore {
  tag: string;
  name: string;
  score: number;
  highlights: string[];
}

function buildContributionScores(changes: MemberChange[]): ContributionScore[] {
  const contributions = new Map<string, { name: string; score: number; highlights: string[] }>();

  const addContribution = (tag: string, name: string, points: number, highlight: string) => {
    if (!tag || points <= 0) return;
    const entry = contributions.get(tag) || { name, score: 0, highlights: [] };
    entry.score += points;
    if (entry.highlights.length < 5) {
      entry.highlights.push(highlight.trim());
    }
    contributions.set(tag, entry);
  };

  for (const change of changes) {
    const tag = change.member?.tag;
    const name = change.member?.name || tag;
    if (!tag || !name) continue;

    const prev = typeof change.previousValue === 'number' ? change.previousValue : undefined;
    const curr = typeof change.newValue === 'number' ? change.newValue : undefined;
    const delta = prev !== undefined && curr !== undefined ? curr - prev : 0;

    switch (change.type) {
      case 'trophy_change': {
        const gain = Math.max(delta, 0);
        if (gain > 0) {
          addContribution(tag, name, gain * 1.5, `Trophies +${gain}`);
        }
        break;
      }
      case 'donation_change': {
        const gain = Math.max(delta, 0);
        if (gain > 0) {
          addContribution(tag, name, gain * 0.4, `Donations +${gain}`);
        }
        break;
      }
      case 'donation_received_change': {
        const gain = Math.max(delta, 0);
        if (gain > 0) {
          addContribution(tag, name, gain * 0.1, `Support +${gain} received`);
        }
        break;
      }
      case 'attack_wins_change': {
        const gain = Math.max(delta, 0);
        if (gain > 0) {
          addContribution(tag, name, gain * 2, `Attack wins +${gain}`);
        }
        break;
      }
      case 'capital_contributions_change': {
        const gain = Math.max(delta, 0);
        if (gain > 0) {
          addContribution(tag, name, gain / 200, `Capital loot +${gain.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);
        }
        break;
      }
      case 'hero_upgrade': {
        addContribution(tag, name, 12, change.description || 'Hero upgrade');
        break;
      }
      case 'town_hall_upgrade': {
        const prevLevel = typeof change.previousValue === 'number' ? change.previousValue : '?';
        const newLevel = typeof change.newValue === 'number' ? change.newValue : '?';
        addContribution(tag, name, 20, `Town Hall ${prevLevel} → ${newLevel}`);
        break;
      }
      case 'role_change': {
        const prevRole = change.previousValue || 'member';
        const newRole = change.newValue || 'member';
        if (prevRole !== newRole) {
          addContribution(tag, name, 6, `Role ${prevRole} → ${newRole}`);
        }
        break;
      }
      default:
        break;
    }
  }

  return Array.from(contributions.entries())
    .map(([tag, data]) => ({ tag, ...data }))
    .sort((a, b) => b.score - a.score);
}

function calculatePlayerOfTheDay(changes: MemberChange[]): SmartInsightsPlayerOfDay | null {
  const ranked = buildContributionScores(changes);

  if (!ranked.length || ranked[0].score < 5) {
    return null;
  }

  const top = ranked[0];
  return {
    playerTag: top.tag,
    playerName: top.name,
    score: Math.round(top.score * 10) / 10,
    highlights: top.highlights,
  };
}

export interface SmartInsightsComposeParams {
  bundle: InsightsBundle;
  clanTag: string;
  snapshotDate: string;
  source: SmartInsightsSource;
  processingTimeMs?: number;
  snapshotId?: string;
  openAIConfigured?: boolean;
  playerOfTheDay?: SmartInsightsPlayerOfDay | null;
  roster?: any;
}

export function composeSmartInsightsPayload({
  bundle,
  clanTag,
  snapshotDate,
  source,
  processingTimeMs = 0,
  snapshotId,
  openAIConfigured = true,
  playerOfTheDay = null,
  roster,
}: SmartInsightsComposeParams): SmartInsightsPayload {
  const truncate = (value?: string, max = 96) => {
    if (!value) return 'Latest update';
    const sanitized = value.replace(/^[-•]\s*/, '').trim();
    return sanitized.length > max ? `${sanitized.slice(0, max - 1).trimEnd()}…` : sanitized;
  };

  const sanitizeBullet = (value: string) => value.replace(/^[-•]\s*/, '').trim();

  const formatDetail = (items: string[]) => {
    const clean = items.map(sanitizeBullet).filter((item) => item.length > 0);
    if (!clean.length) return undefined;
    return ` - ${clean.join('\n- ')}`;
  };

  const detectCategory = (text: string, fallback: SmartInsightsHeadline['category']): SmartInsightsHeadline['category'] => {
    const normalized = text.toLowerCase();
    if (normalized.includes('war') || normalized.includes('battle') || normalized.includes('attack')) {
      return 'war';
    }
    if (normalized.includes('donation') || normalized.includes('donor')) {
      return 'donation';
    }
    return fallback;
  };

  const headlines: SmartInsightsHeadline[] = [];

  const aggregatedChanges = bundle.changes ? groupMemberChanges(bundle.changes) : [];
  const contributionLeaderboard = bundle.changes ? buildContributionScores(bundle.changes) : [];

  if (bundle.changeSummary) {
    const mergedInsights = aggregatedChanges.length
      ? aggregatedChanges.map(formatAggregatedChange)
      : (bundle.changeSummary.insights && bundle.changeSummary.insights.length
        ? bundle.changeSummary.insights
        : bundle.changeSummary.recommendations || []).map((item) => item.trim());
    const changeTitle = truncate(mergedInsights[0] || bundle.changeSummary.content || 'Key activity');
    const changeItems = mergedInsights.length ? mergedInsights : (bundle.changeSummary.content ? [bundle.changeSummary.content] : []);
    const changeDetail = formatDetail(changeItems);
    headlines.push({
      id: 'headline-change',
      title: changeTitle,
      detail: changeDetail,
      priority: bundle.changeSummary.priority || 'medium',
      category: detectCategory(`${changeTitle} ${changeDetail ?? ''}`, 'change'),
    });
  }

  if (bundle.performanceAnalysis) {
    const performanceBullets = (bundle.performanceAnalysis.insights && bundle.performanceAnalysis.insights.length
      ? bundle.performanceAnalysis.insights
      : bundle.performanceAnalysis.recommendations || []).map((item) => item.trim());
    const performanceTitle = truncate(performanceBullets[0] || bundle.performanceAnalysis.content || 'Performance highlights');
    const performanceItems = performanceBullets.length ? performanceBullets : (bundle.performanceAnalysis.content ? [bundle.performanceAnalysis.content] : []);
    const performanceDetail = formatDetail(performanceItems);
    headlines.push({
      id: 'headline-performance',
      title: performanceTitle,
      detail: performanceDetail,
      priority: bundle.performanceAnalysis.priority || 'medium',
      category: detectCategory(`${performanceTitle} ${performanceDetail ?? ''}`, 'performance'),
    });
  }

  if (playerOfTheDay) {
    const playerDetail = formatDetail(playerOfTheDay.highlights);
    headlines.push({
      id: `headline-player-${playerOfTheDay.playerTag}`,
      title: `Player of the Day: ${playerOfTheDay.playerName}`,
      detail: playerDetail,
      priority: 'high',
      category: 'spotlight',
    });
  }

  const coaching = (bundle.coachingInsights || []).map((entry, index) => ({
    id: `coaching-${entry.category || 'general'}-${index}`,
    title: entry.title,
    description: entry.description,
    priority: entry.priority,
    category: entry.category,
    icon: entry.icon,
    chatMessage: entry.chatMessage,
  }));

  const playerSpotlights = (bundle.playerDNAInsights || []).map((player, index) => ({
    id: `player-${player.playerTag || index}`,
    playerTag: player.playerTag,
    playerName: player.playerName,
    archetype: player.archetype,
    headline: player.personality,
    strengths: player.strengths,
    improvementAreas: player.improvementAreas,
    coachingTips: player.coachingTips,
  }));

  const diagnostics: SmartInsightsDiagnostics = {
    openAIConfigured,
    processingTimeMs,
    hasError: !!bundle.error,
    changeSummary: !!bundle.changeSummary,
    coaching: coaching.length > 0,
    playerDNA: playerSpotlights.length > 0,
    clanDNA: !!bundle.clanDNAInsights,
    gameChat: (bundle.gameChatMessages?.length || 0) > 0,
    performanceAnalysis: !!bundle.performanceAnalysis,
    errorMessage: bundle.error,
  };

  const briefingHighlights = buildBriefingHighlights(headlines);
  const briefing: SmartInsightsBriefing = {
    title: "Today's Briefing",
    summary: buildBriefingSummary(briefingHighlights),
    sentiment: deriveBriefingSentiment(briefingHighlights, diagnostics.hasError),
    highlights: briefingHighlights,
  };

  const recognition = buildRecognitionHighlights({
    aggregatedChanges,
    playerOfTheDay,
    contributionScores: contributionLeaderboard,
    roster,
  });

  return {
    metadata: {
      clanTag,
      snapshotDate,
      generatedAt: bundle.timestamp,
      source,
      schemaVersion: SMART_INSIGHTS_SCHEMA_VERSION,
      snapshotId,
    },
    briefing,
    headlines,
    recognition,
    coaching,
    playerSpotlights,
    playerOfTheDay,
    diagnostics,
    context: {
      changeSummary: bundle.changeSummary,
      performanceAnalysis: bundle.performanceAnalysis,
      clanDNAInsights: bundle.clanDNAInsights,
      gameChatMessages: bundle.gameChatMessages,
    },
  };
}

const PRIORITY_ORDER: Record<'high' | 'medium' | 'low', number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function mapHeadlineCategory(
  category: SmartInsightsHeadline['category']
): SmartInsightsBriefingHighlight['category'] {
  if (category === 'change' || category === 'performance' || category === 'war' || category === 'donation' || category === 'spotlight') {
    return category;
  }
  return 'intel';
}

function deriveBriefingTags(headline: SmartInsightsHeadline): string[] | undefined {
  const tags: string[] = [];
  if (headline.category === 'donation') {
    tags.push('donations');
  } else if (headline.category === 'war') {
    tags.push('war');
  } else if (headline.category === 'performance') {
    tags.push('performance');
  } else if (headline.category === 'spotlight') {
    tags.push('spotlight');
  }
  if (headline.priority === 'high') {
    tags.push('priority');
  }
  return tags.length ? Array.from(new Set(tags)) : undefined;
}

function buildBriefingHighlights(headlines: SmartInsightsHeadline[]): SmartInsightsBriefingHighlight[] {
  if (!headlines.length) {
    return [];
  }

  return [...headlines]
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99))
    .slice(0, 5)
    .map((headline) => ({
      id: `briefing-${headline.id}`,
      headline: headline.title,
      detail: headline.detail,
      priority: headline.priority,
      category: mapHeadlineCategory(headline.category),
      tags: deriveBriefingTags(headline),
    }));
}

function buildBriefingSummary(highlights: SmartInsightsBriefingHighlight[]): string {
  if (!highlights.length) {
    return 'No automated highlights available yet.';
  }

  const phrases = highlights.slice(0, 3).map((item) => item.headline.replace(/\.*$/, '').trim());
  return phrases.join('; ');
}

function deriveBriefingSentiment(
  highlights: SmartInsightsBriefingHighlight[],
  hasError: boolean
): SmartInsightsSentiment {
  if (hasError) {
    return 'warning';
  }

  const hasWarning = highlights.some((highlight) => {
    if (highlight.category === 'warning') return true;
    const detail = highlight.detail?.toLowerCase() ?? '';
    return detail.includes('lost') || detail.includes('departed') || detail.includes('inactive');
  });
  if (hasWarning) {
    return 'warning';
  }

  const hasCelebrate = highlights.some((highlight) => highlight.category === 'spotlight' || highlight.category === 'performance');
  return hasCelebrate ? 'positive' : 'neutral';
}

function normalizeContributionText(value: string): string {
  return value.replace(/^[-•]\s*/, '').replace(/\s+/g, ' ').trim();
}

function deriveRecognitionHeadline(contribution: string): string {
  const normalized = contribution.toLowerCase();
  if (normalized.includes('donated')) return 'Donation leader';
  if (normalized.includes('town hall')) return 'Town Hall upgrade';
  if (normalized.includes('role')) return 'Leadership update';
  if (normalized.includes('gained')) return 'Trophy surge';
  if (normalized.includes('joined')) return 'New arrival';
  if (normalized.includes('lost')) return 'Performance dip';
  if (normalized.includes('departed')) return 'Member departure';
  if (normalized.includes('received')) return 'Needs support';
  return contribution.charAt(0).toUpperCase() + contribution.slice(1);
}

function deriveRecognitionTags(contribution: string): string[] | undefined {
  const normalized = contribution.toLowerCase();
  const tags: string[] = [];
  if (normalized.includes('donated') || normalized.includes('received')) {
    tags.push('donations');
  }
  if (normalized.includes('troph')) {
    tags.push('trophies');
  }
  if (normalized.includes('town hall') || normalized.includes('hero')) {
    tags.push('upgrades');
  }
  if (normalized.includes('role')) {
    tags.push('leadership');
  }
  if (normalized.includes('joined')) {
    tags.push('new-member');
  }
  if (normalized.includes('departed')) {
    tags.push('departure');
  }
  return tags.length ? Array.from(new Set(tags)) : undefined;
}

interface RecognitionBuildOptions {
  aggregatedChanges: AggregatedChange[];
  contributionScores: ContributionScore[];
  playerOfTheDay: SmartInsightsPlayerOfDay | null;
  roster?: any;
}

function buildRecognitionHighlights({
  aggregatedChanges,
  contributionScores,
  playerOfTheDay,
  roster,
}: RecognitionBuildOptions): SmartInsightsRecognition {
  const spotlights: SmartInsightsRecognitionEntry[] = [];
  const watchlist: SmartInsightsRecognitionEntry[] = [];
  const callouts: SmartInsightsRecognitionEntry[] = [];
  const seen = new Set<string>();

  if (playerOfTheDay) {
    spotlights.push({
      id: `recognition-spotlight-${playerOfTheDay.playerTag}`,
      playerTag: playerOfTheDay.playerTag,
      playerName: playerOfTheDay.playerName,
      headline: 'Player of the Day',
      reason: playerOfTheDay.highlights[0] || 'Standout contributions across multiple metrics.',
      emphasis: 'celebrate',
      metricValue: playerOfTheDay.score.toFixed(1),
      tags: ['spotlight'],
    });
    seen.add(playerOfTheDay.playerTag);
  }

  const positiveKeywords = [/donated/i, /gained/i, /upgrade/i, /town hall/i, /role/i, /joined/i];
  const cautionKeywords = [/lost/i, /departed/i, /received/i];

  for (const score of contributionScores) {
    if (spotlights.length >= 3) {
      break;
    }
    if (seen.has(score.tag)) {
      continue;
    }

    const topHighlight = score.highlights[0];
    if (!topHighlight) {
      continue;
    }

    spotlights.push({
      id: `recognition-leader-${score.tag}`,
      playerTag: score.tag,
      playerName: score.name,
      headline: deriveRecognitionHeadline(topHighlight),
      reason: normalizeContributionText(topHighlight),
      emphasis: 'celebrate',
      metricValue: `${Math.round(score.score * 10) / 10}`,
      tags: deriveRecognitionTags(topHighlight),
    });
    seen.add(score.tag);
  }

  for (const change of aggregatedChanges) {
    if (seen.has(change.tag)) {
      continue;
    }

    const contribution = change.contributions.find((entry) => positiveKeywords.some((pattern) => pattern.test(entry)));
    if (contribution && spotlights.length < 5) {
      const normalized = normalizeContributionText(contribution);
      spotlights.push({
        id: `recognition-spotlight-${change.tag}`,
        playerTag: change.tag,
        playerName: change.name,
        headline: deriveRecognitionHeadline(normalized),
        reason: normalized,
        emphasis: 'celebrate',
        tags: deriveRecognitionTags(normalized),
      });
      seen.add(change.tag);
      continue;
    }

    const caution = change.contributions.find((entry) => cautionKeywords.some((pattern) => pattern.test(entry)));
    if (caution && watchlist.length < 4) {
      const normalized = normalizeContributionText(caution);
      watchlist.push({
        id: `recognition-watch-${change.tag}`,
        playerTag: change.tag,
        playerName: change.name,
        headline: deriveRecognitionHeadline(normalized),
        reason: normalized,
        emphasis: normalized.toLowerCase().includes('departed') ? 'warn' : 'watch',
        tags: deriveRecognitionTags(normalized),
      });
      seen.add(change.tag);
      continue;
    }

    const spotlightCallout = change.contributions.find((entry) => /role/i.test(entry) || /town hall/i.test(entry));
    if (spotlightCallout && callouts.length < 4) {
      const normalized = normalizeContributionText(spotlightCallout);
      callouts.push({
        id: `recognition-callout-${change.tag}`,
        playerTag: change.tag,
        playerName: change.name,
        headline: deriveRecognitionHeadline(normalized),
        reason: normalized,
        emphasis: 'watch',
        tags: deriveRecognitionTags(normalized),
      });
      seen.add(change.tag);
    }
  }

  if (roster?.members) {
    const members = Array.isArray(roster.members) ? roster.members : [];
    const donationSorted = members
      .filter((member: any) => Number.isFinite(member?.donations))
      .sort((a: any, b: any) => (b.donations || 0) - (a.donations || 0))
      .slice(0, 3);

    for (const member of donationSorted) {
      const tag = member.tag ?? member.playerTag;
      if (!tag || seen.has(tag)) {
        continue;
      }
      spotlights.push({
        id: `recognition-donation-${tag}`,
        playerTag: tag,
        playerName: member.name ?? tag,
        headline: 'Donation leader',
        reason: `${member.donations ?? 0} troops donated this cycle`,
        emphasis: 'celebrate',
        metricValue: `${member.donations ?? 0}`,
        tags: ['donations'],
      });
      seen.add(tag);
      if (spotlights.length >= 5) {
        break;
      }
    }

    const lowDonors = members
      .map((member: any) => {
        const donations = member.donations ?? 0;
        const received = member.donationsReceived ?? 0;
        const deficit = received - donations;
        return {
          member,
          donations,
          received,
          deficit,
        };
      })
      .filter((entry: any) => entry.deficit > 200)
      .sort((a: any, b: any) => b.deficit - a.deficit)
      .slice(0, 3);

    for (const entry of lowDonors) {
      const tag = entry.member.tag ?? entry.member.playerTag;
      if (!tag || seen.has(tag)) {
        continue;
      }
      watchlist.push({
        id: `recognition-support-${tag}`,
        playerTag: tag,
        playerName: entry.member.name ?? tag,
        headline: 'Needs donation support',
        reason: `Net ${entry.deficit} troops received`,
        emphasis: 'watch',
        metricValue: `-${entry.deficit}`,
        tags: ['donations', 'support'],
      });
      seen.add(tag);
    }
  }

  return {
    playerOfTheDay: playerOfTheDay ?? null,
    spotlights,
    watchlist,
    callouts,
  };
}

// Export singleton instance
export const insightsEngine = new InsightsEngine();
