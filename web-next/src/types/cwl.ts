// web-next/src/types/cwl.ts
// CWL data types matching Supabase schema

export interface CwlSeason {
  id: string;
  clan_tag: string;
  season_id: string;
  war_size: 15 | 30;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CwlEligibleMember {
  id: string;
  cwl_season_id: string;
  player_tag: string;
  player_name: string | null;
  town_hall: number | null;
  hero_levels: Record<string, number> | null;
  created_at: string;
}

export interface CwlOpponent {
  id: string;
  cwl_season_id: string;
  day_index: number;
  opponent_tag: string;
  opponent_name: string | null;
  th_distribution: Record<string, number> | null;
  roster_snapshot: any[] | null;
  fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CwlDayLineup {
  id: string;
  cwl_season_id: string;
  day_index: number;
  our_lineup: string[];
  opponent_lineup: string[];
  notes: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CwlDayResult {
  id: string;
  cwl_season_id: string;
  day_index: number;
  result: 'W' | 'L' | 'T' | null;
  our_stars: number | null;
  opponent_stars: number | null;
  our_destruction_pct: number | null;
  opponent_destruction_pct: number | null;
  entered_by: string | null;
  created_at: string;
  updated_at: string;
}

// Request/Response types
export interface CwlSeasonInput {
  clanTag: string;
  seasonId: string;
  warSize?: 15 | 30;
}

export interface CwlOpponentInput {
  dayIndex: number;
  opponentTag: string;
  opponentName?: string;
  thDistribution?: Record<string, number>;
  rosterSnapshot?: any[];
}

export interface CwlEligibleInput {
  playerTag: string;
  playerName?: string;
  townHall?: number;
  heroLevels?: Record<string, number>;
}

export interface CwlLineupInput {
  dayIndex: number;
  ourLineup: string[];
  opponentLineup?: string[];
  notes?: string;
}

export interface CwlResultInput {
  dayIndex: number;
  result?: 'W' | 'L' | 'T';
  ourStars?: number;
  opponentStars?: number;
  ourDestructionPct?: number;
  opponentDestructionPct?: number;
}

