import { NextRequest, NextResponse } from 'next/server';
import { requireLeader } from '@/lib/api/role-check';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getUserClanRoles } from '@/lib/auth/roles';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createApiContext } from '@/lib/api/route-helpers';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getAccessLevelPermissions, type AccessLevel } from '@/lib/access-management';
import { clanRoleFromName } from '@/lib/leadership';

export const dynamic = 'force-dynamic';

export interface AuditLogEntry {
  id: string;
  type: 'note' | 'alias' | 'tenure' | 'departure' | 'warning';
  action: 'created' | 'updated' | 'deleted' | 'archived';
  user: string | null;
  timestamp: string;
  playerTag?: string | null;
  playerName?: string | null;
  details: string;
  metadata?: Record<string, any>;
}

/**
 * Check if user has canViewAuditLog permission (including custom overrides)
 */
async function checkCanViewAuditLog(request: NextRequest, clanTag: string): Promise<boolean> {
  // First check if user is leader (always has access)
  try {
    await requireLeader(request);
    return true; // Leader always has access
  } catch {
    // Not a leader, check custom permissions
  }
  
  // Get user's role from authenticated session (not header)
  let accessLevel: AccessLevel = 'member';
  try {
    const user = await getAuthenticatedUser();
    if (user) {
      const roles = await getUserClanRoles(user.id);
      const clanTag = cfg.homeClanTag;
      const normalizedClanTag = normalizeTag(clanTag || '');
      
      if (normalizedClanTag) {
        const roleForClan = roles.find(r => r.clan_tag === normalizedClanTag);
        if (roleForClan) {
          // Map database role to AccessLevel
          const roleMap: Record<string, AccessLevel> = {
            'leader': 'leader',
            'coleader': 'coleader',
            'elder': 'elder',
            'member': 'member',
            'viewer': 'member',
          };
          accessLevel = roleMap[roleForClan.role] || 'member';
        }
      }
    }
  } catch (error) {
    // If auth fails, default to member access level
    console.warn('[audit-log] Failed to get user role, defaulting to member:', error);
  }
  
  // Get custom permissions
  const supabase = getSupabaseAdminClient();
  const { data: config } = await supabase
    .from('clan_access_configs')
    .select('custom_permissions')
    .eq('clan_tag', clanTag)
    .maybeSingle();
  
  const customPermissions = config?.custom_permissions || null;
  
  // Check permission (default or custom override)
  const permissions = getAccessLevelPermissions(accessLevel, customPermissions);
  return permissions.canViewAuditLog || false;
}

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/audit-log');
  
  try {
    const { searchParams } = new URL(request.url);
    const clanTagParam = searchParams.get('clanTag') || cfg.homeClanTag;
    const clanTag = normalizeTag(clanTagParam);
    
    if (!clanTag) {
      return json({ success: false, error: 'Invalid clan tag' }, { status: 400 });
    }
    
    // Check permission (including custom overrides)
    const hasPermission = await checkCanViewAuditLog(request, clanTag);
    if (!hasPermission) {
      return json(
        { success: false, error: 'Forbidden: View Audit Log permission required' },
        { status: 403 }
      );
    }
    
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const type = searchParams.get('type'); // Filter by type: note, alias, tenure, departure
    const user = searchParams.get('user'); // Filter by user
    
    const supabase = getSupabaseAdminClient();
    const auditEntries: AuditLogEntry[] = [];
    
    // Fetch notes (created and archived)
    if (!type || type === 'note') {
      const { data: notes, error: notesError } = await supabase
        .from('player_notes')
        .select('id, player_tag, player_name, note, created_by, created_at, updated_at, archived_at, archived_by')
        .eq('clan_tag', clanTag)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!notesError && notes) {
        notes.forEach((note) => {
          // Created entry
          auditEntries.push({
            id: `note-created-${note.id}`,
            type: 'note',
            action: 'created',
            user: note.created_by,
            timestamp: note.created_at,
            playerTag: note.player_tag,
            playerName: note.player_name,
            details: `Created note: ${note.note.substring(0, 100)}${note.note.length > 100 ? '...' : ''}`,
            metadata: { noteId: note.id },
          });
          
          // Updated entry (if updated_at differs from created_at)
          if (note.updated_at && note.updated_at !== note.created_at) {
            auditEntries.push({
              id: `note-updated-${note.id}`,
              type: 'note',
              action: 'updated',
              user: note.created_by, // Note: We don't have updated_by yet
              timestamp: note.updated_at,
              playerTag: note.player_tag,
              playerName: note.player_name,
              details: `Updated note: ${note.note.substring(0, 100)}${note.note.length > 100 ? '...' : ''}`,
              metadata: { noteId: note.id },
            });
          }
          
          // Archived entry
          if (note.archived_at) {
            auditEntries.push({
              id: `note-archived-${note.id}`,
              type: 'note',
              action: 'archived',
              user: note.archived_by,
              timestamp: note.archived_at,
              playerTag: note.player_tag,
              playerName: note.player_name,
              details: `Archived note: ${note.note.substring(0, 100)}${note.note.length > 100 ? '...' : ''}`,
              metadata: { noteId: note.id },
            });
          }
        });
      }
    }
    
    // Fetch alias links (created - deletions are hard deletes, so we can't track them)
    if (!type || type === 'alias') {
      const { data: aliases, error: aliasesError } = await supabase
        .from('player_alias_links')
        .select('id, player_tag_1, player_tag_2, created_by, created_at')
        .eq('clan_tag', clanTag)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!aliasesError && aliases) {
        // Look up player names for all unique tags
        const uniqueTags = new Set<string>();
        aliases.forEach((alias) => {
          uniqueTags.add(alias.player_tag_1);
        });
        
        // Get clan_id for members lookup
        const { data: clanRow } = await supabase
          .from('clans')
          .select('id')
          .eq('tag', clanTag)
          .maybeSingle();
        
        // Look up player names in batch
        const playerNameMap = new Map<string, string>();
        if (clanRow?.id && uniqueTags.size > 0) {
          const { data: members } = await supabase
            .from('members')
            .select('tag, name')
            .eq('clan_id', clanRow.id)
            .in('tag', Array.from(uniqueTags));
          
          if (members) {
            members.forEach((member: any) => {
              if (member.tag && member.name) {
                playerNameMap.set(member.tag, member.name);
              }
            });
          }
        }
        
        aliases.forEach((alias) => {
          auditEntries.push({
            id: `alias-created-${alias.id}`,
            type: 'alias',
            action: 'created',
            user: alias.created_by,
            timestamp: alias.created_at,
            playerTag: alias.player_tag_1,
            playerName: playerNameMap.get(alias.player_tag_1) || null,
            details: `Created alias link: ${alias.player_tag_1} ↔ ${alias.player_tag_2}`,
            metadata: { aliasId: alias.id, tag1: alias.player_tag_1, tag2: alias.player_tag_2 },
          });
        });
      }
    }
    
    // Fetch tenure actions (created and archived)
    if (!type || type === 'tenure') {
      const { data: tenureActions, error: tenureError } = await supabase
        .from('player_tenure_actions')
        .select('id, player_tag, player_name, action, granted_by, created_by, created_at, archived_at, archived_by')
        .eq('clan_tag', clanTag)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!tenureError && tenureActions) {
        tenureActions.forEach((action) => {
          // Created entry
          auditEntries.push({
            id: `tenure-created-${action.id}`,
            type: 'tenure',
            action: 'created',
            user: action.created_by || action.granted_by,
            timestamp: action.created_at,
            playerTag: action.player_tag,
            playerName: action.player_name,
            details: `Tenure ${action.action === 'granted' ? 'granted' : 'revoked'}`,
            metadata: { tenureActionId: action.id, action: action.action },
          });
          
          // Archived entry
          if (action.archived_at) {
            auditEntries.push({
              id: `tenure-archived-${action.id}`,
              type: 'tenure',
              action: 'archived',
              user: action.archived_by,
              timestamp: action.archived_at,
              playerTag: action.player_tag,
              playerName: action.player_name,
              details: `Archived tenure action: ${action.action === 'granted' ? 'granted' : 'revoked'}`,
              metadata: { tenureActionId: action.id },
            });
          }
        });
      }
    }
    
    // Fetch departure actions (created and archived)
    if (!type || type === 'departure') {
      const { data: departures, error: departuresError } = await supabase
        .from('player_departure_actions')
        .select('id, player_tag, player_name, departure_type, recorded_by, created_by, created_at, archived_at, archived_by')
        .eq('clan_tag', clanTag)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!departuresError && departures) {
        departures.forEach((departure) => {
          // Created entry
          auditEntries.push({
            id: `departure-created-${departure.id}`,
            type: 'departure',
            action: 'created',
            user: departure.created_by || departure.recorded_by,
            timestamp: departure.created_at,
            playerTag: departure.player_tag,
            playerName: departure.player_name,
            details: `Recorded departure: ${departure.departure_type}`,
            metadata: { departureId: departure.id, departureType: departure.departure_type },
          });
          
          // Archived entry
          if (departure.archived_at) {
            auditEntries.push({
              id: `departure-archived-${departure.id}`,
              type: 'departure',
              action: 'archived',
              user: departure.archived_by,
              timestamp: departure.archived_at,
              playerTag: departure.player_tag,
              playerName: departure.player_name,
              details: `Archived departure record: ${departure.departure_type}`,
              metadata: { departureId: departure.id },
            });
          }
        });
      }
    }
    
    // Sort by timestamp (most recent first)
    auditEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Apply user filter if provided
    let filteredEntries = auditEntries;
    if (user) {
      filteredEntries = auditEntries.filter(entry => 
        entry.user?.toLowerCase().includes(user.toLowerCase())
      );
    }
    
    // Apply pagination
    const paginatedEntries = filteredEntries.slice(offset, offset + limit);
    
    return json({
      success: true,
      data: {
        entries: paginatedEntries,
        total: filteredEntries.length,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('[API] Error fetching audit log:', error);
    if (error instanceof Response) {
      return error; // Re-throw NextResponse errors (from requireLeader)
    }
    return json({ success: false, error: error?.message || 'Failed to fetch audit log' }, { status: 500 });
  }
}

