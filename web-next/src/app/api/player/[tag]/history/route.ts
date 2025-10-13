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
            // Build historical data points with data carry-forward for missing values
            let previousData: HistoricalDataPoint | null = null;
            const snapshotMap = new Map(snapshots.map(s => [s.id, s]));

            // Track last known values for carry-forward
            const lastKnown = {
              trophies: null as number | null,
              rankedTrophies: null as number | null,
              donations: null as number | null,
              donationsReceived: null as number | null,
              heroLevels: {
                bk: null as number | null,
                aq: null as number | null,
                gw: null as number | null,
                rc: null as number | null,
                mp: null as number | null,
              },
              townHallLevel: null as number | null,
              role: null as string | null,
            };

            // Track last REAL (non-carried-forward) hero levels for delta comparison
            const lastRealHeroLevels = {
              bk: null as number | null,
              aq: null as number | null,
              gw: null as number | null,
              rc: null as number | null,
              mp: null as number | null,
            };

            for (const stat of statsData) {
              const snapshot = snapshotMap.get(stat.snapshot_id);
              if (!snapshot) continue;

              const heroLevels: HeroLevels = stat.hero_levels || {};
              
              // Use current value or carry forward from last known
              const trophies = stat.trophies ?? lastKnown.trophies;
              const rankedTrophies = stat.ranked_trophies ?? stat.trophies ?? lastKnown.rankedTrophies;
              const donations = stat.donations ?? lastKnown.donations ?? 0;
              const donationsReceived = stat.donations_received ?? lastKnown.donationsReceived ?? 0;
              const townHallLevel = stat.th_level ?? lastKnown.townHallLevel;
              const role = stat.role ?? lastKnown.role;
              
              const bk = heroLevels.bk ?? lastKnown.heroLevels.bk;
              const aq = heroLevels.aq ?? lastKnown.heroLevels.aq;
              const gw = heroLevels.gw ?? lastKnown.heroLevels.gw;
              const rc = heroLevels.rc ?? lastKnown.heroLevels.rc;
              const mp = heroLevels.mp ?? lastKnown.heroLevels.mp;
              
              // Update last known values when we have new data
              if (stat.trophies !== null) lastKnown.trophies = stat.trophies;
              if (stat.ranked_trophies !== null) lastKnown.rankedTrophies = stat.ranked_trophies;
              else if (stat.trophies !== null) lastKnown.rankedTrophies = stat.trophies;
              if (stat.donations !== null) lastKnown.donations = stat.donations;
              if (stat.donations_received !== null) lastKnown.donationsReceived = stat.donations_received;
              if (stat.th_level !== null) lastKnown.townHallLevel = stat.th_level;
              if (stat.role !== null) lastKnown.role = stat.role;
              if (heroLevels.bk !== null && heroLevels.bk !== undefined) lastKnown.heroLevels.bk = heroLevels.bk;
              if (heroLevels.aq !== null && heroLevels.aq !== undefined) lastKnown.heroLevels.aq = heroLevels.aq;
              if (heroLevels.gw !== null && heroLevels.gw !== undefined) lastKnown.heroLevels.gw = heroLevels.gw;
              if (heroLevels.rc !== null && heroLevels.rc !== undefined) lastKnown.heroLevels.rc = heroLevels.rc;
              if (heroLevels.mp !== null && heroLevels.mp !== undefined) lastKnown.heroLevels.mp = heroLevels.mp;
              
              const currentData: HistoricalDataPoint = {
                date: snapshot.fetched_at.split('T')[0], // YYYY-MM-DD
                fetchedAt: snapshot.fetched_at,
                townHallLevel,
                role,
                trophies,
                rankedTrophies,
                rankedLeagueId: stat.ranked_league_id,
                rankedLeagueName: stat.ranked_league_name,
                donations,
                donationsReceived,
                warStars: null, // Not in member_snapshot_stats yet
                clanCapitalContributions: null, // Not in member_snapshot_stats yet
                heroLevels: {
                  bk,
                  aq,
                  gw,
                  rc,
                  mp,
                },
                rushPercent: stat.rush_percent,
                activityScore: stat.activity_score,
              };

              // Calculate deltas if requested
              if (includeDeltas && previousData) {
                const heroUpgrades: string[] = [];
                
                // Check for hero upgrades - ONLY if we have REAL new data (not carried forward)
                const currentHeroData = stat.hero_levels || {};
                const heroNames: (keyof HeroLevels)[] = ['bk', 'aq', 'gw', 'rc', 'mp'];
                const heroLabels = { bk: 'BK', aq: 'AQ', gw: 'GW', rc: 'RC', mp: 'MP' };
                
                // Only check upgrades if current snapshot has actual hero data
                if (currentHeroData && Object.keys(currentHeroData).length > 0) {
                  for (const hero of heroNames) {
                    // Only report upgrade if current snapshot has this hero's data
                    if (currentHeroData[hero] !== null && currentHeroData[hero] !== undefined) {
                      const currLevel = currentHeroData[hero]!;
                      const prevRealLevel = lastRealHeroLevels[hero];
                      
                      // Only report upgrade if:
                      // 1. We have a previous real level (not first data point)
                      // 2. There's an actual increase
                      if (prevRealLevel !== null && currLevel > prevRealLevel) {
                        heroUpgrades.push(`${heroLabels[hero]}: ${prevRealLevel} → ${currLevel}`);
                      }
                      
                      // Always update last real level when we have actual data
                      lastRealHeroLevels[hero] = currLevel;
                    }
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

    // Sort by date (oldest first) and deduplicate by date (keep latest entry per day)
    historicalData.sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt));
    
    // Deduplicate: keep only the latest snapshot per day
    const uniqueByDate = new Map<string, HistoricalDataPoint>();
    for (const point of historicalData) {
      uniqueByDate.set(point.date, point); // Later entries overwrite earlier ones for same date
    }
    const deduplicatedData = Array.from(uniqueByDate.values());

    // Extract player name if available
    let playerName = playerTag;
    if (deduplicatedData.length > 0 && dataSource === 'roster_snapshots') {
      // Try to get name from member row if we have it
      const { data: memberRow } = await supabase
        .from('members')
        .select('name')
        .eq('tag', playerTag)
        .maybeSingle();
      if (memberRow?.name) {
        playerName = memberRow.name;
      }
    }

    return NextResponse.json({
      success: true,
      data: deduplicatedData,
      meta: {
        playerTag,
        playerName,
        days,
        dataPointsFound: deduplicatedData.length,
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