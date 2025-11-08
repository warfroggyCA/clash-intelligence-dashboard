import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';
import { requireLeader } from '@/lib/api/role-check';
import { sanitizeErrorForApi } from '@/lib/security/error-sanitizer';
import type { CustomPermissions } from '@/components/settings/PermissionManager';

/**
 * GET /api/access/permissions
 * Get custom permissions for a clan
 */
export async function GET(req: NextRequest) {
  try {
    // Require Leader role (not Co-Leader)
    requireLeader(req);

    const { searchParams } = new URL(req.url);
    const clanTagParam = searchParams.get('clanTag');
    
    if (!clanTagParam) {
      return NextResponse.json(
        { success: false, error: 'clanTag is required' },
        { status: 400 }
      );
    }

    const clanTag = normalizeTag(clanTagParam);
    if (!clanTag) {
      return NextResponse.json(
        { success: false, error: 'Invalid clan tag' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    
    // Get clan access config
    const { data: config, error } = await supabase
      .from('clan_access_configs')
      .select('custom_permissions')
      .eq('clan_tag', clanTag)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        customPermissions: config?.custom_permissions || null,
      },
    });
  } catch (error: any) {
    // Handle 403 Forbidden from requireLeader (NextResponse)
    if (error instanceof NextResponse) {
      return error;
    }
    
    console.error('[access/permissions] GET error:', error);
    return NextResponse.json(
      { success: false, error: sanitizeErrorForApi(error).message },
      { status: error?.status || 500 }
    );
  }
}

/**
 * POST /api/access/permissions
 * Save custom permissions for a clan
 */
export async function POST(req: NextRequest) {
  try {
    // Require Leader role (not Co-Leader)
    requireLeader(req);

    const body = await req.json();
    const { clanTag: clanTagParam, customPermissions } = body;

    if (!clanTagParam) {
      return NextResponse.json(
        { success: false, error: 'clanTag is required' },
        { status: 400 }
      );
    }

    if (!customPermissions || typeof customPermissions !== 'object') {
      return NextResponse.json(
        { success: false, error: 'customPermissions must be an object' },
        { status: 400 }
      );
    }

    const clanTag = normalizeTag(clanTagParam);
    if (!clanTag) {
      return NextResponse.json(
        { success: false, error: 'Invalid clan tag' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    
    // Check if config exists
    const { data: existingConfig, error: checkError } = await supabase
      .from('clan_access_configs')
      .select('id, clan_name')
      .eq('clan_tag', clanTag)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error)
      console.error('[access/permissions] Error checking config:', checkError);
      throw new Error(`Database error: ${checkError.message}`);
    }

    // If config doesn't exist, create it with a default clan name
    let configId: string;
    if (!existingConfig) {
      console.log(`[access/permissions] Creating new config for clan ${clanTag}`);
      const { data: newConfig, error: createError } = await supabase
        .from('clan_access_configs')
        .insert({
          clan_tag: clanTag,
          clan_name: `Clan ${clanTag}`, // Default name, can be updated later
        })
        .select('id')
        .single();

      if (createError) {
        console.error('[access/permissions] Error creating config:', createError);
        throw new Error(`Failed to create access configuration: ${createError.message}`);
      }

      configId = newConfig.id;
    } else {
      configId = existingConfig.id;
    }

    // Update custom permissions
    // If all levels are empty/null, set to NULL to use defaults
    const hasAnyCustom = Object.values(customPermissions).some(
      (levelPerms: any) => levelPerms && Object.keys(levelPerms).length > 0
    );

    const { error: updateError } = await supabase
      .from('clan_access_configs')
      .update({
        custom_permissions: hasAnyCustom ? customPermissions : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', configId);

    if (updateError) {
      console.error('[access/permissions] Update error:', updateError);
      throw new Error(`Failed to update permissions: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Permissions saved successfully',
    });
  } catch (error: any) {
    // Handle 403 Forbidden from requireLeader (NextResponse)
    if (error instanceof NextResponse) {
      return error;
    }
    
    console.error('[access/permissions] POST error:', error);
    return NextResponse.json(
      { success: false, error: sanitizeErrorForApi(error).message },
      { status: error?.status || 500 }
    );
  }
}

