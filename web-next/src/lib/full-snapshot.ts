import { promises as fsp } from 'fs';
import path from 'path';
import { cfg } from './config';
import { normalizeTag, safeTagForFilename } from './tags';
import {
  getClanInfo,
  getClanMembers,
  getPlayer,
  getClanWarLog,
  getClanCurrentWar,
  getClanCapitalRaidSeasons,
} from './coc';
import { rateLimiter } from './rate-limiter';

const SNAPSHOT_VERSION = '2025-09-15';

export interface MemberSummary {
  tag: string;
  name: string;
  role?: string;
  townHallLevel?: number;
  builderHallLevel?: number;
  townHallWeaponLevel?: number;
  trophies?: number;
  builderTrophies?: number;
  donations?: number;
  donationsReceived?: number;
  clanRank?: number;
  previousClanRank?: number;
  league?: any;
}

export interface FullClanSnapshot {
  clanTag: string;
  fetchedAt: string;
  clan: any;
  memberSummaries: MemberSummary[];
  playerDetails: Record<string, any>;
  currentWar: any | null;
  warLog: any[];
  capitalRaidSeasons: any[];
  metadata: {
    memberCount: number;
    warLogEntries: number;
    capitalSeasons: number;
    version: string;
  };
}

export interface FetchFullSnapshotOptions {
  warLogLimit?: number;
  capitalSeasonLimit?: number;
  includePlayerDetails?: boolean;
}

export async function fetchFullClanSnapshot(
  clanTag: string,
  options: FetchFullSnapshotOptions = {}
): Promise<FullClanSnapshot> {
  const normalizedTag = normalizeTag(clanTag);
  const fetchPlayers = options.includePlayerDetails !== false;
  const [clan, members] = await Promise.all([
    getClanInfo(normalizedTag),
    getClanMembers(normalizedTag),
  ]);

  const warLogLimit = options.warLogLimit ?? 10;
  const capitalSeasonLimit = options.capitalSeasonLimit ?? 3;

  const [warLog, currentWar, capitalRaidSeasons] = await Promise.all([
    getClanWarLog(normalizedTag, warLogLimit),
    getClanCurrentWar(normalizedTag),
    getClanCapitalRaidSeasons(normalizedTag, capitalSeasonLimit),
  ]);

  const playerDetails: Record<string, any> = {};
  if (fetchPlayers) {
    await Promise.all(
      members.map(async (member: any) => {
        const tag = normalizeTag(member.tag);
        await rateLimiter.acquire();
        try {
          const detail = await getPlayer(tag);
          playerDetails[tag] = detail;
        } catch (error) {
          console.error('[FullSnapshot] Failed to fetch player detail', member.tag, error);
        } finally {
          rateLimiter.release();
        }
      })
    );
  }

  const memberSummaries: MemberSummary[] = members.map((member: any) => {
    const tag = normalizeTag(member.tag);
    const detail = playerDetails[tag];
    return {
      tag,
      name: member.name,
      role: member.role,
      townHallLevel: detail?.townHallLevel ?? member.townHallLevel,
      builderHallLevel: detail?.builderHallLevel,
      townHallWeaponLevel: detail?.townHallWeaponLevel,
      trophies: member.trophies ?? detail?.trophies,
      builderTrophies: detail?.versusTrophies,
      donations: member.donations ?? detail?.achievements?.find?.((a: any) => a.name === 'Friend in Need')?.value,
      donationsReceived: member.donationsReceived,
      clanRank: member.clanRank,
      previousClanRank: member.previousClanRank,
      league: member.league ?? detail?.league,
    };
  });

  return {
    clanTag: normalizedTag,
    fetchedAt: new Date().toISOString(),
    clan,
    memberSummaries,
    playerDetails,
    currentWar,
    warLog,
    capitalRaidSeasons,
    metadata: {
      memberCount: members.length,
      warLogEntries: warLog.length,
      capitalSeasons: capitalRaidSeasons.length,
      version: SNAPSHOT_VERSION,
    },
  };
}

export async function persistFullClanSnapshot(snapshot: FullClanSnapshot): Promise<void> {
  const safeTag = safeTagForFilename(snapshot.clanTag);
  const timestamp = snapshot.fetchedAt.replace(/[:.]/g, '-');
  const filename = `${safeTag}_${timestamp}.json`;

  if (cfg.useLocalData) {
    const dir = path.join(process.cwd(), cfg.dataRoot, 'full-snapshots');
    await fsp.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await fsp.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`[FullSnapshot] Saved local snapshot ${filePath}`);
  } else {
    console.log('[FullSnapshot] TODO: store snapshot row in Supabase clan_snapshots table', filename);
  }
}
