import { cfg } from '@/lib/config';
import { appendTenureLedgerEntry } from '@/lib/tenure';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';
import { ymdNowUTC, daysSinceToDate } from '@/lib/date';

type TenureAction = 'granted' | 'revoked';

export interface ApplyTenureOptions {
  clanTag?: string | null;
  playerTag: string;
  playerName?: string | null;
  baseDays: number;
  asOf?: string;
  reason?: string | null;
  action?: TenureAction;
  grantedBy?: string | null;
  createdBy?: string | null;
  targetDate?: string | null;
}

export interface ApplyTenureResult {
  clanTag: string | null;
  playerTag: string;
  playerName?: string | null;
  baseDays: number;
  asOf: string;
  tenureDays: number;
  action: TenureAction;
  tenureAction?: Record<string, any> | null;
}

/**
 * Centralised tenure updater: records a ledger entry, logs the action in Supabase,
 * and returns the effective tenure that downstream consumers should display immediately.
 */
export async function applyTenureAction(options: ApplyTenureOptions): Promise<ApplyTenureResult> {
  const clanTag = options.clanTag ? normalizeTag(options.clanTag) : (cfg.homeClanTag ? normalizeTag(cfg.homeClanTag) : null);
  const playerTag = normalizeTag(options.playerTag);
  if (!playerTag) {
    throw new Error('Player tag is required');
  }

  const asOf = options.asOf ?? ymdNowUTC();
  const baseDays = Math.max(0, Math.round(options.baseDays ?? 0));
  const action: TenureAction = options.action ?? 'granted';

  await appendTenureLedgerEntry(playerTag, baseDays, asOf);

  let tenureAction: Record<string, any> | null = null;
  if (cfg.useSupabase && cfg.database.serviceRoleKey) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('player_tenure_actions')
        .insert({
          clan_tag: clanTag,
          player_tag: playerTag,
          player_name: options.playerName ?? null,
          action,
          reason: options.reason ?? null,
          granted_by: options.grantedBy ?? null,
          created_by: options.createdBy ?? null,
        })
        .select()
        .single();
      if (error) {
        console.warn('[tenure-service] Failed to insert player_tenure_actions record', error);
      } else {
        tenureAction = data ?? null;
      }
    } catch (error) {
      console.warn('[tenure-service] Failed to insert player_tenure_actions record', error);
    }
  }

  const target = options.targetDate ?? ymdNowUTC();
  const accrued = daysSinceToDate(asOf, target);
  const tenureDays = Math.max(0, Math.round(baseDays + accrued));

  return {
    clanTag,
    playerTag,
    playerName: options.playerName ?? null,
    baseDays,
    asOf,
    tenureDays,
    action,
    tenureAction,
  };
}

/**
 * Automatically creates initial tenure entries for new clan members.
 * This should be called when new members are detected joining the clan.
 */
export async function createInitialTenureForJoiners(params: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  clanTag: string;
  joinerTags: string[];
  joinDate: string;
  memberLookup?: Map<string, { name: string }>;
}): Promise<void> {
  const { supabase, clanTag, joinerTags, joinDate, memberLookup } = params;
  
  if (!joinerTags.length) return;

  console.log(`[tenure-service] Creating initial tenure entries for ${joinerTags.length} new joiners`);

  for (const playerTag of joinerTags) {
    try {
      const member = memberLookup?.get(playerTag);
      const playerName = member?.name || null;

      // Create initial tenure entry with 0 base days, starting from join date
      await applyTenureAction({
        clanTag,
        playerTag,
        playerName,
        baseDays: 0, // Start with 0 days
        asOf: joinDate, // Start accruing from join date
        reason: 'Automatic tenure creation for new clan member',
        action: 'granted',
        grantedBy: 'system',
        createdBy: 'system',
      });

      console.log(`[tenure-service] Created initial tenure entry for ${playerName || playerTag} (${playerTag})`);
    } catch (error) {
      console.error(`[tenure-service] Failed to create tenure entry for ${playerTag}:`, error);
      // Continue with other joiners even if one fails
    }
  }
}
