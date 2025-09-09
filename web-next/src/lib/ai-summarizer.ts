// web-next/src/lib/ai-summarizer.ts
// AI-powered change summarization using OpenAI

import OpenAI from 'openai';
import { MemberChange, ChangeSummary } from './snapshots';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateChangeSummary(
  changes: MemberChange[],
  clanTag: string,
  date: string,
  customPrompt?: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return generateFallbackSummary(changes);
  }

  if (changes.length === 0) {
    return "No significant changes detected in the clan today.";
  }

  try {
    const prompt = customPrompt || buildPrompt(changes, clanTag, date);
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: customPrompt ? 
            "You are a helpful assistant that provides comprehensive analysis of Clash of Clans clan data. Provide detailed, actionable insights for clan leadership." :
            "You are a helpful assistant that summarizes Clash of Clans clan activity in a concise, engaging way. Focus on the most important changes and present them in a friendly, clan-leader tone."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: customPrompt ? 800 : 300,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || generateFallbackSummary(changes);
  } catch (error) {
    console.error('OpenAI API error:', error);
    return generateFallbackSummary(changes);
  }
}

function buildPrompt(changes: MemberChange[], clanTag: string, date: string): string {
  const changeDescriptions = changes.map(change => `- ${change.description}`).join('\n');
  
  return `Please summarize these Clash of Clans clan changes for ${clanTag} on ${date}:

${changeDescriptions}

Create a brief, engaging summary (2-3 sentences) that highlights the most important developments. Focus on:
- New members joining
- Significant upgrades (Town Hall, heroes)
- Notable trophy/donation activity
- Role changes

Keep it concise and positive, as if reporting to a clan leader.`;
}

function generateFallbackSummary(changes: MemberChange[]): string {
  if (changes.length === 0) {
    return "No significant changes detected in the clan today.";
  }

  const newMembers = changes.filter(c => c.type === 'new_member').length;
  const leftMembers = changes.filter(c => c.type === 'left_member').length;
  const heroUpgrades = changes.filter(c => c.type === 'hero_upgrade').length;
  const thUpgrades = changes.filter(c => c.type === 'town_hall_upgrade').length;
  const trophyChanges = changes.filter(c => c.type === 'trophy_change').length;
  const donationChanges = changes.filter(c => c.type === 'donation_change').length;

  const summaryParts: string[] = [];

  if (newMembers > 0) {
    summaryParts.push(`${newMembers} new member${newMembers > 1 ? 's' : ''} joined`);
  }
  if (leftMembers > 0) {
    summaryParts.push(`${leftMembers} member${leftMembers > 1 ? 's' : ''} left`);
  }
  if (thUpgrades > 0) {
    summaryParts.push(`${thUpgrades} Town Hall upgrade${thUpgrades > 1 ? 's' : ''}`);
  }
  if (heroUpgrades > 0) {
    summaryParts.push(`${heroUpgrades} hero upgrade${heroUpgrades > 1 ? 's' : ''}`);
  }
  if (trophyChanges > 0) {
    summaryParts.push(`significant trophy changes`);
  }
  if (donationChanges > 0) {
    summaryParts.push(`active donation activity`);
  }

  if (summaryParts.length === 0) {
    return "Minor changes detected in the clan today.";
  }

  return `Today's clan activity: ${summaryParts.join(', ')}.`;
}

export async function generateDetailedSummary(changes: MemberChange[]): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return generateDetailedFallbackSummary(changes);
  }

  if (changes.length === 0) {
    return "No changes to report.";
  }

  try {
    const changeDetails = changes.map(change => {
      let detail = change.description;
      if (change.previousValue !== undefined && change.newValue !== undefined) {
        detail += ` (${change.previousValue} → ${change.newValue})`;
      }
      return detail;
    }).join('\n');

    const prompt = `Provide a detailed summary of these Clash of Clans clan changes. Group related changes and highlight the most significant developments:

${changeDetails}

Create a structured summary with clear sections for different types of changes.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a detailed clan activity reporter. Provide structured, informative summaries of clan changes with clear sections and bullet points."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content || generateDetailedFallbackSummary(changes);
  } catch (error) {
    console.error('OpenAI API error for detailed summary:', error);
    return generateDetailedFallbackSummary(changes);
  }
}

function generateDetailedFallbackSummary(changes: MemberChange[]): string {
  const grouped = {
    newMembers: changes.filter(c => c.type === 'new_member'),
    leftMembers: changes.filter(c => c.type === 'left_member'),
    upgrades: changes.filter(c => c.type === 'town_hall_upgrade' || c.type === 'hero_upgrade'),
    activity: changes.filter(c => c.type === 'trophy_change' || c.type === 'donation_change'),
    roles: changes.filter(c => c.type === 'role_change'),
  };

  let summary = "## Clan Activity Summary\n\n";

  if (grouped.newMembers.length > 0) {
    summary += "### New Members\n";
    grouped.newMembers.forEach(change => {
      summary += `- ${change.description}\n`;
    });
    summary += "\n";
  }

  if (grouped.leftMembers.length > 0) {
    summary += "### Members Who Left\n";
    grouped.leftMembers.forEach(change => {
      summary += `- ${change.description}\n`;
    });
    summary += "\n";
  }

  if (grouped.upgrades.length > 0) {
    summary += "### Upgrades\n";
    grouped.upgrades.forEach(change => {
      summary += `- ${change.description}`;
      if (change.previousValue !== undefined && change.newValue !== undefined) {
        summary += ` (${change.previousValue} → ${change.newValue})`;
      }
      summary += "\n";
    });
    summary += "\n";
  }

  if (grouped.activity.length > 0) {
    summary += "### Activity\n";
    grouped.activity.forEach(change => {
      summary += `- ${change.description}`;
      if (change.previousValue !== undefined && change.newValue !== undefined) {
        summary += ` (${change.previousValue} → ${change.newValue})`;
      }
      summary += "\n";
    });
    summary += "\n";
  }

  if (grouped.roles.length > 0) {
    summary += "### Role Changes\n";
    grouped.roles.forEach(change => {
      summary += `- ${change.description}\n`;
    });
    summary += "\n";
  }

  return summary.trim();
}

// Max hero levels for each Town Hall (updated 2024)
const HERO_MAX_LEVELS: Record<number, Record<"bk"|"aq"|"gw"|"rc"|"mp", number>> = {
  7: { bk: 10, aq: 0, gw: 0, rc: 0, mp: 0 },
  8: { bk: 20, aq: 0, gw: 0, rc: 0, mp: 0 },
  9: { bk: 30, aq: 30, gw: 0, rc: 0, mp: 30 },
  10: { bk: 40, aq: 40, gw: 0, rc: 0, mp: 40 },
  11: { bk: 50, aq: 50, gw: 20, rc: 0, mp: 50 },
  12: { bk: 65, aq: 65, gw: 40, rc: 0, mp: 65 },
  13: { bk: 75, aq: 75, gw: 50, rc: 25, mp: 75 },
  14: { bk: 80, aq: 80, gw: 65, rc: 40, mp: 80 },
  15: { bk: 90, aq: 90, gw: 75, rc: 50, mp: 90 },
  16: { bk: 95, aq: 95, gw: 80, rc: 65, mp: 95 },
  17: { bk: 100, aq: 100, gw: 90, rc: 75, mp: 100 }
};

// Helper function to get hero key from description
function getHeroKeyFromDescription(description: string): "bk" | "aq" | "gw" | "rc" | "mp" | null {
  if (description.includes('BK') || description.includes('Barbarian King')) return 'bk';
  if (description.includes('AQ') || description.includes('Archer Queen')) return 'aq';
  if (description.includes('GW') || description.includes('Grand Warden')) return 'gw';
  if (description.includes('RC') || description.includes('Royal Champion')) return 'rc';
  if (description.includes('MP') || description.includes('Minion Prince')) return 'mp';
  return null;
}

// Helper function to calculate remaining levels to max
function getRemainingLevels(townHallLevel: number, heroKey: string, currentLevel: number): number | null {
  const maxLevel = HERO_MAX_LEVELS[townHallLevel]?.[heroKey as keyof typeof HERO_MAX_LEVELS[number]];
  if (!maxLevel || maxLevel === 0) return null;
  return Math.max(0, maxLevel - currentLevel);
}

// Generate copyable game chat messages for significant achievements
export function generateGameChatMessages(changes: MemberChange[]): string[] {
  const messages: string[] = [];
  
  // Hero upgrades (any level for now, can adjust thresholds later)
  const heroUpgrades = changes.filter(change => change.type === 'hero_upgrade');
  
  for (const change of heroUpgrades) {
    const heroName = getHeroDisplayName(change.description);
    const heroKey = getHeroKeyFromDescription(change.description);
    const townHallLevel = change.member.townHallLevel;
    
    // Calculate remaining levels if we have the data
    let remainingText = '';
    if (heroKey && townHallLevel) {
      const remaining = getRemainingLevels(townHallLevel, heroKey, change.newValue);
      if (remaining !== null && remaining > 0) {
        remainingText = ` Only ${remaining} to go!`;
      }
    }
    
    if (change.newValue >= 90) {
      messages.push(`🎉 ${change.member.name} just MAXED their ${heroName}! Incredible dedication! 🏆`);
    } else if (change.newValue >= 75) {
      messages.push(`🔥 ${change.member.name} upgraded their ${heroName} to level ${change.newValue}!${remainingText} Getting close to max! 💪`);
    } else if (change.newValue >= 50) {
      messages.push(`⚡ ${change.member.name} upgraded their ${heroName} to level ${change.newValue}!${remainingText} Great progress! 🎯`);
    } else {
      messages.push(`💪 ${change.member.name} upgraded their ${heroName} to level ${change.newValue}!${remainingText} Keep it up! 🚀`);
    }
  }
  
  // Town Hall upgrades
  const thUpgrades = changes.filter(change => change.type === 'town_hall_upgrade');
  for (const change of thUpgrades) {
    messages.push(`🏰 ${change.member.name} upgraded to Town Hall ${change.newValue}! Welcome to the next level! 🎊`);
  }
  
  // Trophy pushes (100+ trophies)
  const trophyPushes = changes.filter(change => 
    change.type === 'trophy_change' && 
    change.newValue && change.previousValue &&
    (change.newValue - change.previousValue) >= 100
  );
  
  for (const change of trophyPushes) {
    const gain = change.newValue - change.previousValue;
    messages.push(`📈 ${change.member.name} just pushed ${gain} trophies! From ${change.previousValue} to ${change.newValue}! 🚀`);
  }
  
  // New members
  const newMembers = changes.filter(change => change.type === 'new_member');
  if (newMembers.length > 0) {
    if (newMembers.length === 1) {
      messages.push(`👋 Welcome ${newMembers[0].member.name} to the clan! Great to have you! 🎉`);
    } else {
      const names = newMembers.map(m => m.member.name).join(', ');
      messages.push(`👋 Welcome our new members: ${names}! Great to have you all! 🎉`);
    }
  }
  
  // Role promotions
  const roleChanges = changes.filter(change => 
    change.type === 'role_change' && 
    change.newValue && 
    (change.newValue === 'co-leader' || change.newValue === 'coLeader' || change.newValue === 'elder' || change.newValue === 'admin')
  );
  
  for (const change of roleChanges) {
    const roleName = change.newValue === 'coLeader' ? 'Co-Leader' : 
                    change.newValue === 'co-leader' ? 'Co-Leader' :
                    change.newValue === 'admin' ? 'Elder' : change.newValue;
    const roleEmoji = (change.newValue === 'co-leader' || change.newValue === 'coLeader') ? '💎' : '⭐';
    messages.push(`${roleEmoji} Congratulations ${change.member.name} on becoming ${roleName}! Well deserved! 🎊`);
  }
  
  // High donation activity (500+ donations)
  const donationActivity = changes.filter(change => 
    change.type === 'donation_change' && 
    change.newValue && change.previousValue &&
    (change.newValue - change.previousValue) >= 500
  );
  
  for (const change of donationActivity) {
    const donations = change.newValue - change.previousValue;
    messages.push(`💝 ${change.member.name} donated ${donations} troops today! You're a donation machine! 🏆`);
  }
  
  return messages;
}

// Helper function to extract hero name from description
function getHeroDisplayName(description: string): string {
  if (description.includes('BK') || description.includes('Barbarian King')) return 'Barbarian King';
  if (description.includes('AQ') || description.includes('Archer Queen')) return 'Archer Queen';
  if (description.includes('GW') || description.includes('Grand Warden')) return 'Grand Warden';
  if (description.includes('RC') || description.includes('Royal Champion')) return 'Royal Champion';
  if (description.includes('MP') || description.includes('Minion Prince')) return 'Minion Prince';
  return 'Hero';
}
