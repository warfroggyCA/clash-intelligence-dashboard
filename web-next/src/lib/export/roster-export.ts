/**
 * Roster Export Utilities
 * Functions to export roster data in various formats (CSV, Discord, Summary)
 */

import type { RosterData } from '@/app/(dashboard)/simple-roster/roster-transform';
import { toCSV, downloadCSV, copyToClipboard, discord } from '../export-utils';
import { normalizeTag } from '../tags';
import { calculateRushPercentage, getMemberActivity } from '../business/calculations';
import type { Member } from '@/types';

/**
 * Export roster to CSV format
 */
export function exportRosterToCSV(roster: RosterData): string {
  const headers = [
    'Name',
    'Tag',
    'Role',
    'TH',
    'League',
    'Trophies',
    'VIP Score',
    'Last Week',
    'Running Total',
    'Tenure (days)',
    'Rush %',
    'BK',
    'AQ',
    'GW',
    'RC',
    'MP',
    'Activity',
    'Donations',
    'Received',
  ];

  const rows = roster.members.map((member) => {
    const activity = getMemberActivity(member as Member);
    const rushPercent = calculateRushPercentage(member as Member);

    return [
      member.name || '',
      member.tag || '',
      member.role || 'member',
      String(member.townHallLevel || ''),
      member.rankedLeagueName || 'N/A',
      String(member.trophies || 0),
      member.vip ? String(member.vip.score.toFixed(1)) : '',
      member.lastWeekTrophies !== null && member.lastWeekTrophies !== undefined
        ? String(member.lastWeekTrophies)
        : '',
      member.seasonTotalTrophies !== null && member.seasonTotalTrophies !== undefined
        ? String(member.seasonTotalTrophies)
        : '',
      member.tenureDays !== null && member.tenureDays !== undefined
        ? String(member.tenureDays)
        : '',
      String(rushPercent.toFixed(1)),
      String(member.bk || ''),
      String(member.aq || ''),
      String(member.gw || ''),
      String(member.rc || ''),
      String(member.mp || ''),
      activity.level || '',
      String(member.donations || 0),
      String(member.donationsReceived || 0),
    ];
  });

  return toCSV(headers, rows);
}

/**
 * Format roster for Discord posting
 */
export function formatRosterForDiscord(roster: RosterData): string {
  const clanTag = roster.clanTag || '#UNKNOWN';
  const memberCount = roster.members.length;
  const snapshotDate = roster.snapshotMetadata?.snapshotDate
    ? roster.snapshotMetadata.snapshotDate.split('T')[0]
    : 'Unknown';

  let message = `${discord.emoji.shield} ${discord.bold(`${roster.clanName} Roster`)} ${discord.emoji.shield}\n\n`;
  message += `${discord.bold('Clan Info:')}\n`;
  message += `${discord.bullet(`Tag: ${discord.code(clanTag)}`)}\n`;
  message += `${discord.bullet(`Members: ${memberCount}`)}\n`;
  message += `${discord.bullet(`Snapshot Date: ${snapshotDate}`)}\n\n`;

  // Sort by VIP score (descending) for Discord display
  const sortedMembers = [...roster.members].sort((a, b) => {
    const aVip = a.vip?.score ?? 0;
    const bVip = b.vip?.score ?? 0;
    return bVip - aVip;
  });

  message += `${discord.bold('Top VIP Leaders:')}\n`;
  const topVip = sortedMembers.slice(0, 5).filter(m => m.vip);
  if (topVip.length > 0) {
    topVip.forEach((member, index) => {
      const vipScore = member.vip?.score.toFixed(1) || 'N/A';
      const trend = member.vip?.trend === 'up' ? discord.emoji.arrow_up
        : member.vip?.trend === 'down' ? discord.emoji.arrow_down
          : '→';
      message += `${discord.bullet(`${index + 1}. ${discord.bold(member.name)} ${discord.code(member.tag)} - VIP: ${vipScore} ${trend}`)}\n`;
    });
  } else {
    message += `${discord.bullet('No VIP scores available')}\n`;
  }

  message += '\n';

  // Top donators
  const topDonors = [...roster.members]
    .sort((a, b) => (b.donations || 0) - (a.donations || 0))
    .slice(0, 5);

  message += `${discord.emoji.gift} ${discord.bold('Top Donators:')}\n`;
  topDonors.forEach((member, index) => {
    message += `${discord.bullet(`${index + 1}. ${member.name} - ${(member.donations || 0).toLocaleString()} donations`)}\n`;
  });

  message += '\n';

  // Activity summary
  const activityCounts = {
    veryActive: 0,
    active: 0,
    moderate: 0,
    low: 0,
    inactive: 0,
  };

  roster.members.forEach((member) => {
    const activity = getMemberActivity(member as Member);
    if (activity.level === 'Very Active') activityCounts.veryActive++;
    else if (activity.level === 'Active') activityCounts.active++;
    else if (activity.level === 'Moderate') activityCounts.moderate++;
    else if (activity.level === 'Low') activityCounts.low++;
    else activityCounts.inactive++;
  });

  message += `${discord.emoji.chart} ${discord.bold('Activity Breakdown:')}\n`;
  message += `${discord.bullet(`Very Active: ${activityCounts.veryActive}`)}\n`;
  message += `${discord.bullet(`Active: ${activityCounts.active}`)}\n`;
  message += `${discord.bullet(`Moderate: ${activityCounts.moderate}`)}\n`;
  message += `${discord.bullet(`Low: ${activityCounts.low}`)}\n`;
  message += `${discord.bullet(`Inactive: ${activityCounts.inactive}`)}\n`;

  message += '\n';
  message += `${discord.italic('Generated by Clash Intelligence Dashboard')}`;

  return message;
}

/**
 * Format full roster table for clipboard
 * Uses TSV (Tab-Separated Values) format for easy pasting into Excel/Google Sheets
 * Also works well for LLMs and other tools
 */
export function formatRosterSummary(roster: RosterData): string {
  const clanTag = roster.clanTag || '#UNKNOWN';
  const memberCount = roster.members.length;
  const snapshotDate = roster.snapshotMetadata?.snapshotDate
    ? roster.snapshotMetadata.snapshotDate.split('T')[0]
    : 'Unknown';

  // Table header (tab-separated)
  const headers = [
    'Name',
    'Tag',
    'Role',
    'TH',
    'League',
    'Trophies',
    'VIP',
    'Last Week',
    'Running Total',
    'Tenure',
    'Rush %',
    'BK',
    'AQ',
    'GW',
    'RC',
    'MP',
    'Activity',
    'Donated',
    'Received',
  ];

  // Build TSV format (tab-separated values)
  // Excel/Google Sheets will automatically recognize tabs and create columns
  let output = headers.join('\t') + '\n';

  // Data rows (tab-separated)
  roster.members.forEach((member) => {
    const activity = getMemberActivity(member as Member);
    const rushPercent = calculateRushPercentage(member as Member);

    const row = [
      member.name || '',
      member.tag || '',
      member.role || 'member',
      String(member.townHallLevel || ''),
      member.rankedLeagueName || 'N/A',
      String(member.trophies || 0),
      member.vip ? String(member.vip.score.toFixed(1)) : 'N/A',
      member.lastWeekTrophies !== null && member.lastWeekTrophies !== undefined
        ? String(member.lastWeekTrophies)
        : '',
      member.seasonTotalTrophies !== null && member.seasonTotalTrophies !== undefined
        ? String(member.seasonTotalTrophies)
        : '',
      member.tenureDays !== null && member.tenureDays !== undefined
        ? String(member.tenureDays)
        : '',
      String(rushPercent.toFixed(1)),
      String(member.bk || ''),
      String(member.aq || ''),
      String(member.gw || ''),
      String(member.rc || ''),
      String(member.mp || ''),
      activity.level || '',
      String(member.donations || 0),
      String(member.donationsReceived || 0),
    ];

    output += row.join('\t') + '\n';
  });

  return output;
}

/**
 * Handle CSV export - generates CSV and triggers download
 */
export async function handleExportCSV(roster: RosterData): Promise<boolean> {
  try {
    const csv = exportRosterToCSV(roster);
    const clanTag = normalizeTag(roster.clanTag || 'UNKNOWN').replace('#', '');
    const date = new Date().toISOString().split('T')[0];
    const filename = `roster-${clanTag}-${date}.csv`;

    downloadCSV(filename, csv);
    return true;
  } catch (error) {
    console.error('Failed to export CSV:', error);
    return false;
  }
}

/**
 * Handle Discord format export - formats and copies to clipboard
 */
export async function handleExportDiscord(roster: RosterData): Promise<boolean> {
  try {
    const formatted = formatRosterForDiscord(roster);
    return await copyToClipboard(formatted);
  } catch (error) {
    console.error('Failed to export Discord format:', error);
    return false;
  }
}

/**
 * Handle summary copy - generates summary and copies to clipboard
 */
export async function handleCopySummary(roster: RosterData): Promise<boolean> {
  try {
    const summary = formatRosterSummary(roster);
    return await copyToClipboard(summary);
  } catch (error) {
    console.error('Failed to copy summary:', error);
    return false;
  }
}

