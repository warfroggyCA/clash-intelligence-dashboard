import { NextRequest, NextResponse } from "next/server";
import { normalizeTag, isValidTag } from "@/lib/tags";
import { createApiContext } from "@/lib/api/route-helpers";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { cfg } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HeroLevels {
  bk?: number | null;
  aq?: number | null;
  gw?: number | null;
  rc?: number | null;
  mp?: number | null;
}

interface HistoricalDataPoint {
  date: string;
  fetchedAt: string;
  
  // Town Hall & Role
  townHallLevel: number | null;
  role: string | null;
  
  // Trophies
  trophies: number | null;
  rankedTrophies: number | null;
  rankedLeagueId: number | null;
  rankedLeagueName: string | null;
  
  // Donations
  donations: number | null;
  donationsReceived: number | null;
  
  // War & Capital
  warStars: number | null;
  clanCapitalContributions: number | null;
  
  // Heroes
  heroLevels: HeroLevels | null;
  
  // Progression Metrics
  rushPercent: number | null;
  activityScore: number | null;
  
  // Deltas (changes from previous snapshot)
  deltas?: {
    trophies: number;
    rankedTrophies: number;
    donations: number;
    donationsReceived: number;
    warStars: number;
    clanCapitalContributions: number;
    heroUpgrades: string[]; // e.g., ["bk: 79 → 80", "aq: 79 → 80"]
    townHallUpgrade: boolean;
    roleChange: boolean;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { tag: string } }
) {
  const context = createApiContext(request, `/api/player/${params.tag}/history`);
  
  try {
    const playerTag = normalizeTag(params.tag);
    if (!isValidTag(playerTag)) {
      return NextResponse.json(
        { success: false, error: "Invalid player tag format" },
        { status: 400 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const daysParam = url.searchParams.get('days');
    const includeDeltas = url.searchParams.get('includeDeltas') !== 'false'; // default true
    const days = Math.min(Math.max(parseInt(daysParam || '30'), 1), 365);

    const supabase = getSupabaseAdminClient();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // First, try the NEW data structure (roster_snapshots + member_snapshot_stats)
    const clanTag = normalizeTag(cfg.homeClanTag || '');
    
    // Get clan ID
    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id, tag, name')
      .eq('tag', clanTag)
      .single();

    let historicalData: HistoricalDataPoint[] = [];
    let dataSource = 'none';

    if (clanRow && !clanError) {
      // Get member ID for this player
      const { data: memberRow, error: memberError } = await supabase
        .from('members')
        .select('id, tag, name')
        .eq('clan_id', clanRow.id)
        .eq('tag', playerTag)
        .maybeSingle();

      if (memberRow && !memberError) {
        // Fetch historical snapshots for this member from the new structure
        const { data: snapshots, error: snapshotError } = await supabase
          .from('roster_snapshots')
          .select('id, fetched_at, metadata')
          .eq('clan_id', clanRow.id)
          .gte('fetched_at', startDate.toISOString())
          .lte('fetched_at', endDate.toISOString())
          .order('fetched_at', { ascending: true });

        if (snapshots && !snapshotError && snapshots.length > 0) {
          const snapshotIds = snapshots.map(s => s.id);

          // Fetch all member stats for this player across these snapshots
          const { data: statsData, error: statsError } = await supabase
            .from('member_snapshot_stats')
            .select('*')
            .eq('member_id', memberRow.id)
            .in('snapshot_id', snapshotIds)
            .order('snapshot_id', { ascending: true });

          if (statsData && !statsError) {
            // Build historical data points
            let previousData: HistoricalDataPoint | null = null;
            const snapshotMap = new Map(snapshots.map(s => [s.id, s]));

            for (const stat of statsData) {
              const snapshot = snapshotMap.get(stat.snapshot_id);
              if (!snapshot) continue;

              const heroLevels: HeroLevels = stat.hero_levels || {};
              
              const currentData: HistoricalDataPoint = {
                date: snapshot.fetched_at.split('T')[0], // YYYY-MM-DD
                fetchedAt: snapshot.fetched_at,
                townHallLevel: stat.th_level,
                role: stat.role,
                trophies: stat.trophies,
                rankedTrophies: stat.ranked_trophies || stat.trophies,
                rankedLeagueId: stat.ranked_league_id,
                rankedLeagueName: stat.ranked_league_name,
                donations: stat.donations,
                donationsReceived: stat.donations_received,
                warStars: null, // Not in member_snapshot_stats yet
                clanCapitalContributions: null, // Not in member_snapshot_stats yet
                heroLevels: {
                  bk: heroLevels.bk ?? null,
                  aq: heroLevels.aq ?? null,
                  gw: heroLevels.gw ?? null,
                  rc: heroLevels.rc ?? null,
                  mp: heroLevels.mp ?? null,
                },
                rushPercent: stat.rush_percent,
                activityScore: stat.activity_score,
              };

              // Calculate deltas if requested
              if (includeDeltas && previousData) {
                const heroUpgrades: string[] = [];
                
                // Check for hero upgrades
                const prevHeroes = previousData.heroLevels || {};
                const currHeroes = currentData.heroLevels || {};
                
                const heroNames: (keyof HeroLevels)[] = ['bk', 'aq', 'gw', 'rc', 'mp'];
                const heroLabels = { bk: 'BK', aq: 'AQ', gw: 'GW', rc: 'RC', mp: 'MP' };
                
                for (const hero of heroNames) {
                  const prevLevel = prevHeroes[hero] ?? 0;
                  const currLevel = currHeroes[hero] ?? 0;
                  if (currLevel > prevLevel) {
                    heroUpgrades.push(`${heroLabels[hero]}: ${prevLevel} → ${currLevel}`);
                  }
                }

                currentData.deltas = {
                  trophies: (currentData.trophies ?? 0) - (previousData.trophies ?? 0),
                  rankedTrophies: (currentData.rankedTrophies ?? 0) - (previousData.rankedTrophies ?? 0),
                  donations: (currentData.donations ?? 0) - (previousData.donations ?? 0),
                  donationsReceived: (currentData.donationsReceived ?? 0) - (previousData.donationsReceived ?? 0),
                  warStars: 0, // Not available yet
                  clanCapitalContributions: 0, // Not available yet
                  heroUpgrades,
                  townHallUpgrade: (currentData.townHallLevel ?? 0) > (previousData.townHallLevel ?? 0),
                  roleChange: currentData.role !== previousData.role,
                };
              }

              historicalData.push(currentData);
              previousData = currentData;
            }

            dataSource = 'roster_snapshots';
          }
        }
      }
    }

    // Fallback to OLD full_snapshots table if no data from new structure
    if (historicalData.length === 0) {
      const { data: oldSnapshots, error: oldError } = await supabase
        .from('full_snapshots')
        .select('snapshot_date, snapshot_data')
        .gte('snapshot_date', startDate.toISOString().split('T')[0])
        .lte('snapshot_date', endDate.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: true });

      if (oldSnapshots && !oldError) {
        let previousData: HistoricalDataPoint | null = null;

        for (const snapshot of oldSnapshots) {
          if (!snapshot.snapshot_data || !snapshot.snapshot_data.members) {
            continue;
          }

          const playerData = snapshot.snapshot_data.members.find(
            (member: any) => normalizeTag(member.tag) === playerTag
          );

          if (playerData) {
            const currentData: HistoricalDataPoint = {
              date: snapshot.snapshot_date,
              fetchedAt: snapshot.snapshot_date,
              townHallLevel: playerData.townHallLevel || playerData.th || null,
              role: playerData.role || null,
              trophies: playerData.trophies || null,
              rankedTrophies: playerData.trophies || null,
              rankedLeagueId: null,
              rankedLeagueName: null,
              donations: playerData.donations || null,
              donationsReceived: playerData.donationsReceived || null,
              warStars: playerData.warStars || null,
              clanCapitalContributions: playerData.clanCapitalContributions || null,
              heroLevels: null,
              rushPercent: null,
              activityScore: null,
            };

            // Calculate deltas if requested
            if (includeDeltas && previousData) {
              currentData.deltas = {
                trophies: (currentData.trophies ?? 0) - (previousData.trophies ?? 0),
                rankedTrophies: (currentData.rankedTrophies ?? 0) - (previousData.rankedTrophies ?? 0),
                donations: (currentData.donations ?? 0) - (previousData.donations ?? 0),
                donationsReceived: (currentData.donationsReceived ?? 0) - (previousData.donationsReceived ?? 0),
                warStars: (currentData.warStars ?? 0) - (previousData.warStars ?? 0),
                clanCapitalContributions: (currentData.clanCapitalContributions ?? 0) - (previousData.clanCapitalContributions ?? 0),
                heroUpgrades: [],
                townHallUpgrade: (currentData.townHallLevel ?? 0) > (previousData.townHallLevel ?? 0),
                roleChange: currentData.role !== previousData.role,
              };
            }

            historicalData.push(currentData);
            previousData = currentData;
          }
        }

        dataSource = 'full_snapshots';
      }
    }

    return NextResponse.json({
      success: true,
      data: historicalData,
      meta: {
        playerTag,
        days,
        dataPointsFound: historicalData.length,
        dataSource,
        includeDeltas,
      }
    });

  } catch (error) {
    console.error('[Player History API] Error:', error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}