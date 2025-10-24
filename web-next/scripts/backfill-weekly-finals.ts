#!/usr/bin/env ts-node

/**
 * Backfill ranked weekly finals in member_snapshot_stats from player_day.
 *
 * Usage:
 *   ts-node scripts/backfill-weekly-finals.ts --tag "#G9QVRYC2Y,#OTHER"
 *
 * Options:
 *   --tag / -t       Comma-separated list of player tags to backfill (default: all members)
 *   --since / -s     Earliest date (inclusive, YYYY-MM-DD) to consider (default: 2025-09-01)
 *   --dry-run / -d   Print actions without updating Supabase
 */

import { Command } from 'commander';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';

const program = new Command();

program
  .option('-t, --tag <tags>', 'Comma-separated list of member tags to backfill')
  .option('-s, --since <date>', 'Earliest date (YYYY-MM-DD) to backfill from', '2025-09-01')
  .option('-d, --dry-run', 'Dry run (no updates)', false);

program.parse(process.argv);

interface WeekEntry {
  weekKey: string;
  finalTrophies: number;
  snapshotId: string;
  memberId: string;
  snapshotDate: string | null;
  currentSnapshotRanked: number | null;
}

const DEFAULT_SINCE = '2025-09-01';

function getWeekKey(dateString: string): string {
  const base = normalizeUtcDate(dateString);
  const day = base.getUTCDay();
  const diff = base.getUTCDate() - day + (day === 0 ? -6 : 1);
  base.setUTCDate(diff);
  base.setUTCHours(0, 0, 0, 0);
  return base.toISOString().slice(0, 10);
}

function normalizeUtcDate(raw: string): Date {
  let value = raw.trim();
  if (!value) {
    throw new Error('Cannot parse empty date string');
  }
  if (!value.includes('T') && value.includes(' ')) {
    value = value.replace(' ', 'T');
  }
  if (!/[zZ]$/.test(value) && !/[+-]\d{2}:?\d{2}$/.test(value)) {
    value = `${value}Z`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid date string: ${raw}`);
  }
  return date;
}

async function main() {
  const options = program.opts();
  const dryRun = Boolean(options.dryRun);
  const sinceDateString = options.since ?? DEFAULT_SINCE;
  const sinceDate = normalizeUtcDate(`${sinceDateString}T00:00:00`);
  const supabase = getSupabaseAdminClient();

  const { data: clans, error: clansError } = await supabase
    .from('clans')
    .select('id, tag');
  if (clansError) {
    throw new Error(`Failed to load clans: ${clansError.message}`);
  }

  const tagFilter: string[] | null = options.tag
    ? String(options.tag)
        .split(',')
        .map((tag) => normalizeTag(tag.trim()))
        .filter(Boolean)
    : null;

  const updates: Array<{ memberId: string; weekKey: string; trophies: number; snapshotId: string }> = [];

  for (const clan of clans ?? []) {
    const clanTag = normalizeTag(clan.tag);
    if (!clan.id) continue;

    // Fetch members for this clan to build ID map
    const { data: memberRows, error: memberError } = await supabase
      .from('members')
      .select('id, tag')
      .eq('clan_id', clan.id);
    if (memberError) {
      console.warn(`[backfill-weekly-finals] Skip clan ${clanTag}: failed to load members`, memberError.message);
      continue;
    }

    const memberIdByTag = new Map<string, string>();
    for (const member of memberRows ?? []) {
      const normalized = normalizeTag(member.tag);
      memberIdByTag.set(normalized, member.id);
    }

    const targetMemberIds =
      tagFilter?.length
        ? Array.from(memberIdByTag.entries())
            .filter(([tag]) => tagFilter.includes(tag))
            .map(([, id]) => id)
        : Array.from(memberIdByTag.values());

    if (!targetMemberIds.length) {
      continue;
    }

    const { data: playerDayRows, error: playerDayError } = await supabase
      .from('player_day')
      .select('player_tag, date, trophies')
      .in(
        'player_tag',
        tagFilter?.length ? tagFilter : Array.from(memberIdByTag.keys()),
      )
      .gte('date', sinceDateString)
      .order('player_tag', { ascending: true })
      .order('date', { ascending: true });

    if (playerDayError) {
      console.warn(`[backfill-weekly-finals] Skip clan ${clanTag}: failed to load player_day`, playerDayError.message);
      continue;
    }

    // Build per-member Monday-only finals (plausible legend finals only)
    const weeklyByMember = new Map<string, Map<string, number>>();
    for (const row of playerDayRows ?? []) {
      const tag = normalizeTag(row.player_tag);
      if (!memberIdByTag.has(tag)) continue;
      if (!row.date) continue;
      const ranked = Number(row.trophies ?? 0);
      if (!Number.isFinite(ranked) || ranked <= 0 || ranked > 600) continue;

      const weekKey = getWeekKey(row.date);
      const weekMonday = normalizeUtcDate(`${weekKey}T00:00:00Z`);
      if (weekMonday < sinceDate) continue;
      // Only take exact Monday rows from player_day
      if (!String(row.date).startsWith(weekKey)) continue;

      if (!weeklyByMember.has(tag)) {
        weeklyByMember.set(tag, new Map<string, number>());
      }
      const weekMap = weeklyByMember.get(tag)!;
      const current = weekMap.get(weekKey) ?? 0;
      if (ranked > current) {
        weekMap.set(weekKey, ranked);
      }
    }

    // Re-query per member to avoid huge fetch; fallback to per-member fetch
    for (const [tag, weeklyMap] of weeklyByMember) {
      const memberId = memberIdByTag.get(tag);
      if (!memberId) continue;
      const weekEntries = Array.from(weeklyMap.entries());
      if (!weekEntries.length) continue;

      const { data: memberStats, error: memberStatsError } = await supabase
        .from('member_snapshot_stats')
        .select('snapshot_id, snapshot_date, ranked_trophies')
        .eq('member_id', memberId);
      if (memberStatsError) {
        console.warn(`[backfill-weekly-finals] Failed to load stats for ${tag}`, memberStatsError.message);
        continue;
      }

      // Index Monday snapshots only for each week (snapshot row we will update)
      const weekToSnapshots = new Map<string, WeekEntry>();
      for (const stat of memberStats ?? []) {
        const dateIso = stat.snapshot_date ?? null;
        if (!dateIso) continue;
        const weekKey = getWeekKey(dateIso);
        // require Monday exact day for the snapshot row we will write to
        if (!dateIso.startsWith(weekKey)) continue;
        weekToSnapshots.set(weekKey, {
          weekKey,
          finalTrophies: Number(stat.ranked_trophies ?? 0),
          snapshotId: stat.snapshot_id,
          memberId,
          snapshotDate: dateIso,
          currentSnapshotRanked: stat.ranked_trophies ?? null,
        });
      }

      for (const [weekKey, mondayFinalFromPlayerDay] of weekEntries) {
        const existing = weekToSnapshots.get(weekKey);
        if (!existing) continue; // no Monday row to update
        const current = Number(existing.finalTrophies ?? 0);
        const currentPlausible = Number.isFinite(current) && current > 0 && current <= 600;
        const target = mondayFinalFromPlayerDay; // exact Monday value from player_day
        const needsUpdate = (!currentPlausible && target > 0) || (current !== target);
        if (needsUpdate) {
          updates.push({
            memberId,
            weekKey,
            trophies: target,
            snapshotId: existing.snapshotId,
          });
        }
      }
    }
  }

  if (!updates.length) {
    console.log('No updates needed.');
    return;
  }

  console.log(`Prepared ${updates.length} updates.`);
  if (dryRun) {
    updates.forEach((u) => {
      console.log(`[DRY RUN] member ${u.memberId} week ${u.weekKey} -> ${u.trophies}`);
    });
    return;
  }

  for (const update of updates) {
    const { error } = await supabase
      .from('member_snapshot_stats')
      .update({ ranked_trophies: update.trophies })
      .eq('member_id', update.memberId)
      .eq('snapshot_id', update.snapshotId);

    if (error) {
      console.warn(`[backfill-weekly-finals] Failed to update member_id=${update.memberId} snapshot_id=${update.snapshotId}`, error.message);
    } else {
      console.log(`Updated member ${update.memberId} snapshot ${update.snapshotId}: ranked_trophies=${update.trophies}`);
    }
  }

  console.log('Backfill completed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
