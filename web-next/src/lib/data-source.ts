// web-next/src/lib/data-source.ts
// Data source abstraction for local vs Supabase data

import { cfg } from './config';
import { normalizeTag, safeTagForFilename } from './tags';
import { DailySnapshot, ChangeSummary, convertFullSnapshotToDailySnapshot } from './snapshots';
import { promises as fsp } from 'fs';
import path from 'path';

// Local file system data source
class LocalDataSource {
  private dataRoot: string;
  private fallbackDataRoot: string;

  constructor() {
    this.dataRoot = cfg.dataRoot;
    this.fallbackDataRoot = cfg.fallbackDataRoot;
  }

  async getLatestSnapshot(clanTag: string): Promise<DailySnapshot | null> {
    try {
      // Try to load from local snapshots first
      const snapshotsDir = path.join(process.cwd(), this.dataRoot, 'snapshots');
      const safeTag = safeTagForFilename(clanTag);
      
      const files = await fsp.readdir(snapshotsDir);
      const snapshotFiles = files
        .filter(f => f.startsWith(safeTag) && f.endsWith('.json'))
        .sort()
        .reverse();

      if (snapshotFiles.length === 0) {
        console.log('No local snapshots found, trying fallback data...');
        return this.getFallbackSnapshot(clanTag);
      }

      const latestFile = snapshotFiles[0];
      const data = await fsp.readFile(path.join(snapshotsDir, latestFile), 'utf-8');
      return JSON.parse(data) as DailySnapshot;
    } catch (error) {
      console.log('Failed to load local snapshot, trying fallback:', error);
      return this.getFallbackSnapshot(clanTag);
    }
  }

  async getFallbackSnapshot(clanTag: string): Promise<DailySnapshot | null> {
    try {
      // Try to load from fallback data
      const fallbackDir = path.join(process.cwd(), this.fallbackDataRoot);
      const safeTag = safeTagForFilename(clanTag);
      
      const files = await fsp.readdir(fallbackDir);
      const snapshotFiles = files
        .filter(f => f.startsWith(safeTag) && f.endsWith('.json'))
        .sort()
        .reverse();

      if (snapshotFiles.length === 0) {
        console.log('No fallback snapshots found');
        return null;
      }

      const latestFile = snapshotFiles[0];
      const data = await fsp.readFile(path.join(fallbackDir, latestFile), 'utf-8');
      return JSON.parse(data) as DailySnapshot;
    } catch (error) {
      console.log('Failed to load fallback snapshot:', error);
      return null;
    }
  }

  async loadSnapshot(clanTag: string, date: string): Promise<DailySnapshot | null> {
    try {
      const snapshotsDir = path.join(process.cwd(), this.dataRoot, 'snapshots');
      const safeTag = safeTagForFilename(clanTag);
      const filename = `${safeTag}_${date}.json`;
      
      const data = await fsp.readFile(path.join(snapshotsDir, filename), 'utf-8');
      return JSON.parse(data) as DailySnapshot;
    } catch (error) {
      console.log(`Failed to load snapshot for ${date}:`, error);
      return null;
    }
  }

  async getChangeSummaries(clanTag: string): Promise<ChangeSummary[]> {
    try {
      const changesDir = path.join(process.cwd(), this.dataRoot, 'changes');
      const safeTag = safeTagForFilename(clanTag);
      
      const files = await fsp.readdir(changesDir);
      const changeFiles = files
        .filter(f => f.startsWith(safeTag) && f.endsWith('.json'))
        .sort()
        .reverse();

      const summaries: ChangeSummary[] = [];
      for (const file of changeFiles) {
        try {
          const data = await fsp.readFile(path.join(changesDir, file), 'utf-8');
          summaries.push(JSON.parse(data) as ChangeSummary);
        } catch (error) {
          console.error(`Failed to load change summary ${file}:`, error);
        }
      }

      return summaries;
    } catch (error) {
      console.log('Failed to load change summaries:', error);
      return [];
    }
  }
}

// Supabase data source
class SupabaseDataSource {
  async getLatestSnapshot(clanTag: string): Promise<DailySnapshot | null> {
    try {
      const { supabase } = await import('@/lib/supabase');
      const safeTag = safeTagForFilename(clanTag);
      
      const { data: record, error } = await supabase
        .from('clan_snapshots')
        .select('clan_tag, fetched_at, snapshot_date, clan, member_summaries, player_details, current_war, war_log, capital_seasons, metadata')
        .eq('clan_tag', safeTag)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();

      if (!error && record) {
        const fullSnapshot = {
          clanTag: normalizeTag(record.clan_tag),
          fetchedAt: record.fetched_at,
          clan: record.clan,
          memberSummaries: record.member_summaries,
          playerDetails: record.player_details,
          currentWar: record.current_war,
          warLog: record.war_log,
          capitalRaidSeasons: record.capital_seasons,
          metadata: record.metadata,
        };
        return convertFullSnapshotToDailySnapshot(fullSnapshot);
      }

      const isNotFound = error?.code === 'PGRST116';
      if (error && !isNotFound) {
        console.error('Failed to load clan_snapshots record:', error);
      }

      // Fallback to legacy snapshots table (pre full snapshot migration)
      const { data: snapshotData, error: legacyError } = await supabase
        .from('snapshots')
        .select('*')
        .eq('clan_tag', safeTag)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      
      if (legacyError || !snapshotData) {
        return null;
      }
      
      const response = await fetch(snapshotData.file_url);
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data as DailySnapshot;
    } catch (error) {
      console.log('Failed to load Supabase snapshot:', error);
      return null;
    }
  }

  async loadSnapshot(clanTag: string, date: string): Promise<DailySnapshot | null> {
    try {
      const { supabase } = await import('@/lib/supabase');
      const safeTag = safeTagForFilename(clanTag);
      
      const { data: record, error } = await supabase
        .from('clan_snapshots')
        .select('clan_tag, fetched_at, snapshot_date, clan, member_summaries, player_details, current_war, war_log, capital_seasons, metadata')
        .eq('clan_tag', safeTag)
        .eq('snapshot_date', date)
        .single();

      if (!error && record) {
        const fullSnapshot = {
          clanTag: normalizeTag(record.clan_tag),
          fetchedAt: record.fetched_at,
          clan: record.clan,
          memberSummaries: record.member_summaries,
          playerDetails: record.player_details,
          currentWar: record.current_war,
          warLog: record.war_log,
          capitalRaidSeasons: record.capital_seasons,
          metadata: record.metadata,
        };
        return convertFullSnapshotToDailySnapshot(fullSnapshot);
      }

      const isNotFound = error?.code === 'PGRST116';
      if (error && !isNotFound) {
        console.error('Failed to load clan_snapshots record:', error);
      }

      // Fallback to legacy snapshots storage
      const filename = `${safeTag}_${date}.json`;
      const { data: snapshotData, error: legacyError } = await supabase
        .from('snapshots')
        .select('file_url')
        .eq('clan_tag', safeTag)
        .eq('filename', filename)
        .single();
      
      if (legacyError || !snapshotData) {
        return null;
      }
      
      const response = await fetch(snapshotData.file_url);
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data as DailySnapshot;
    } catch (error) {
      console.log('Failed to load Supabase snapshot:', error);
      return null;
    }
  }

  async getChangeSummaries(clanTag: string): Promise<ChangeSummary[]> {
    try {
      const { getAISummaries } = await import('@/lib/supabase');
      const supabaseSummaries = await getAISummaries(clanTag);
      
      return supabaseSummaries.map((summary: any) => ({
        date: summary.date,
        clanTag: summary.clan_tag,
        changes: [],
        summary: summary.summary,
        gameChatMessages: [],
        unread: summary.unread,
        actioned: summary.actioned,
        createdAt: summary.created_at
      }));
    } catch (error) {
      console.log('Failed to load Supabase change summaries:', error);
      return [];
    }
  }
}

// Data source factory
export function createDataSource() {
  if (cfg.useLocalData) {
    console.log('📁 Using local data source for development');
    return new LocalDataSource();
  } else {
    console.log('☁️ Using Supabase data source');
    return new SupabaseDataSource();
  }
}

// Export the data source instance
export const dataSource = createDataSource();
