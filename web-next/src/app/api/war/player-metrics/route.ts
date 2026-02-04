// web-next/src/app/api/war/player-metrics/route.ts
// Roll up last-N war attack performance per player (SSOT: clan_wars + clan_war_attacks)

export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

const GetSchema = z.object({
  clanTag: z.string().min(2),
  limit: z.coerce.number().min(1).max(20).optional().default(3),
  warType: z.string().optional().default('regular'),
});

type PlayerWarMetrics = {
  warsConsidered: number;
  attacksUsed: number;
  avgStars: number | null;
  avgDestructionPct: number | null;
  tripleRate: number | null;
  lowHitRate: number | null; // (0-1 stars) / attacks
};

export async function GET(request: Request) {
  const { json } = createApiContext(request, '/api/war/player-metrics');

  try {
    const { searchParams } = new URL(request.url);
    const parsed = GetSchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'clanTag required' }, { status: 400 });
    }

    const clanTag = normalizeTag(parsed.data.clanTag);
    if (!clanTag) {
      return json({ success: false, error: 'Invalid clanTag' }, { status: 400 });
    }

    const warType = parsed.data.warType;
    const limit = parsed.data.limit;

    const admin = getSupabaseAdminClient();

    // Pick last N ended wars for this clan.
    const { data: wars, error: warErr } = await admin
      .from('clan_wars')
      .select('id, battle_start')
      .eq('clan_tag', clanTag)
      .eq('war_type', warType)
      // Use battle_start ordering as the most reliable key across ingestion variants.
      .not('battle_start', 'is', null)
      .order('battle_start', { ascending: false })
      .limit(limit);

    if (warErr) throw new Error(warErr.message);

    const warIds = (wars ?? []).map((w) => w.id).filter(Boolean);
    if (warIds.length === 0) {
      return json({ success: true, data: { clanTag, warType, limit, warIds: [], metrics: {} } });
    }

    const { data: attacks, error: atkErr } = await admin
      .from('clan_war_attacks')
      .select('war_id, attacker_tag, stars, destruction')
      .in('war_id', warIds)
      .eq('attacker_clan_tag', clanTag);

    if (atkErr) throw new Error(atkErr.message);

    const acc: Record<string, { attacks: number; stars: number; destruction: number; triples: number; lowHits: number }> = {};

    for (const row of attacks ?? []) {
      const tag = normalizeTag(row.attacker_tag || '');
      if (!tag) continue;
      if (!acc[tag]) acc[tag] = { attacks: 0, stars: 0, destruction: 0, triples: 0, lowHits: 0 };
      const stars = typeof row.stars === 'number' ? row.stars : 0;
      const destr = typeof row.destruction === 'number' ? row.destruction : 0;
      acc[tag].attacks += 1;
      acc[tag].stars += stars;
      acc[tag].destruction += destr;
      if (stars === 3) acc[tag].triples += 1;
      if (stars <= 1) acc[tag].lowHits += 1;
    }

    const metrics: Record<string, PlayerWarMetrics> = {};
    for (const [tag, v] of Object.entries(acc)) {
      const attacksUsed = v.attacks;
      metrics[tag] = {
        warsConsidered: warIds.length,
        attacksUsed,
        avgStars: attacksUsed ? Number((v.stars / attacksUsed).toFixed(2)) : null,
        avgDestructionPct: attacksUsed ? Number((v.destruction / attacksUsed).toFixed(1)) : null,
        tripleRate: attacksUsed ? Number((v.triples / attacksUsed).toFixed(3)) : null,
        lowHitRate: attacksUsed ? Number((v.lowHits / attacksUsed).toFixed(3)) : null,
      };
    }

    return json({
      success: true,
      data: {
        clanTag,
        warType,
        limit,
        warIds,
        metrics,
      },
    });
  } catch (error: any) {
    console.error('[API] war/player-metrics error:', error);
    return json({ success: false, error: error?.message || 'Failed to compute player war metrics' }, { status: 500 });
  }
}
