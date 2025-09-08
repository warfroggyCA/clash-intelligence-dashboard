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
