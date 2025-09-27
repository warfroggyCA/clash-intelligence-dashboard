import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { calculateAceScores, createAceInputsFromRoster, ACE_DEFAULT_WEIGHTS, ACE_DEFAULT_LOGISTIC_ALPHA } from '@/lib/ace-score';
import type { Member, Roster } from '@/types';

interface SnapshotFile {
  clanTag?: string;
  fetchedAt?: string;
  clan?: {
    name?: string | null;
    tag?: string | null;
  } | null;
  memberSummaries?: Array<Record<string, any>>;
}

function normalizeMember(summary: Record<string, any>): Member {
  return {
    tag: summary.tag ?? undefined,
    name: summary.name ?? summary.tag ?? 'Unknown Player',
    townHallLevel: summary.townHallLevel ?? summary.th ?? undefined,
    trophies: summary.trophies ?? undefined,
    versusTrophies: summary.versusTrophies ?? undefined,
    donations: summary.donations ?? undefined,
    donationsReceived: summary.donationsReceived ?? undefined,
    extras: summary.extras ?? undefined,
  } as Member;
}

function logisticFromScore(ace: number, availability: number): number {
  if (!Number.isFinite(ace) || !Number.isFinite(availability) || availability <= 0) {
    return 0;
  }
  return ace / (100 * availability);
}

function coreFromLogistic(logistic: number, alpha: number): number {
  const clamped = Math.min(0.999, Math.max(0.001, logistic));
  return Math.log(clamped / (1 - clamped)) / alpha;
}

export const runtime = 'nodejs';

export async function GET() {
  try {
    const snapshotsDir = path.join(process.cwd(), 'out', 'full-snapshots');
    const entries = await fs.readdir(snapshotsDir);
    const jsonFiles = entries.filter((file) => file.endsWith('.json')).sort();

    if (!jsonFiles.length) {
      return NextResponse.json(
        { success: false, error: 'NO_SNAPSHOTS' },
        { status: 404 }
      );
    }

    const latestFile = jsonFiles[jsonFiles.length - 1];
    const filePath = path.join(snapshotsDir, latestFile);
    const raw = await fs.readFile(filePath, 'utf-8');
    const snapshot: SnapshotFile = JSON.parse(raw);

    const membersRaw = Array.isArray(snapshot.memberSummaries) ? snapshot.memberSummaries : [];
    if (!membersRaw.length) {
      return NextResponse.json(
        { success: false, error: 'NO_MEMBERS' },
        { status: 404 }
      );
    }

    const members = membersRaw.map(normalizeMember);

    const roster: Roster = {
      source: 'snapshot',
      clanTag: snapshot.clanTag ?? snapshot.clan?.tag ?? 'UNKNOWN',
      clanName: snapshot.clan?.name ?? 'Unknown Clan',
      members,
    } as Roster;

    const inputs = createAceInputsFromRoster(roster);
    const scores = calculateAceScores(inputs);

    if (!scores.length) {
      return NextResponse.json(
        { success: false, error: 'NO_SCORES' },
        { status: 404 }
      );
    }

    const top = scores[0];
    const member = members.find((m) => m.tag === top.tag);
    const availability = top.availability ?? 1;
    const logistic = logisticFromScore(top.ace, availability);
    const core = coreFromLogistic(logistic, ACE_DEFAULT_LOGISTIC_ALPHA);

    const breakdown = [
      { code: 'OAE', name: 'Offense Above Expectation', weight: ACE_DEFAULT_WEIGHTS.ova, value: top.breakdown.ova.shrunk },
      { code: 'DAE', name: 'Defense Above Expectation', weight: ACE_DEFAULT_WEIGHTS.dva, value: top.breakdown.dva.shrunk },
      { code: 'PR', name: 'Participation & Reliability', weight: ACE_DEFAULT_WEIGHTS.par, value: top.breakdown.par.shrunk },
      { code: 'CAP', name: 'Capital Value', weight: ACE_DEFAULT_WEIGHTS.cap, value: top.breakdown.cap.shrunk },
      { code: 'DON', name: 'Donation Culture', weight: ACE_DEFAULT_WEIGHTS.don, value: top.breakdown.don.shrunk },
    ].map((component) => ({
      ...component,
      weighted: component.weight * component.value,
    }));

    const topComponent = [...breakdown].sort((a, b) => b.value - a.value)[0];
    const highlight = topComponent
      ? `${topComponent.code} leads the score at ${(topComponent.value).toFixed(2)}σ`
      : null;

    return NextResponse.json({
      success: true,
      roster: {
        clan: roster.clanName,
        clanTag: roster.clanTag,
        fetchedAt: snapshot.fetchedAt ?? null,
        memberCount: members.length,
        snapshotFile: latestFile,
      },
      player: {
        tag: top.tag,
        name: top.name,
        townHallLevel: member?.townHallLevel ?? null,
        role: (member as any)?.role ?? null,
        ace: top.ace,
        availability,
        highlight,
      },
      breakdown,
      core,
      logistic,
      logisticAlpha: ACE_DEFAULT_LOGISTIC_ALPHA,
    });
  } catch (error) {
    console.error('[api/faq/ace-example] Failed to build example', error);
    return NextResponse.json(
      { success: false, error: 'UNEXPECTED_ERROR' },
      { status: 500 }
    );
  }
}

