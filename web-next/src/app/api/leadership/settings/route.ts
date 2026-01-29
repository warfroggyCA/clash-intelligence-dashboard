import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth/guards';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

export async function GET(req: NextRequest) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const clanTag = normalizeTag(searchParams.get('clanTag') || cfg.homeClanTag || '');
    
    if (!clanTag) {
      return NextResponse.json({ success: false, error: 'Clan tag required' }, { status: 400 });
    }

    // Require leadership to view settings
    await requireRole(req, ['leader', 'coleader'], { clanTag });

    const supabase = getSupabaseServerClient();
    
    // Get clan ID first
    const { data: clan } = await supabase
      .from('clans')
      .select('id')
      .eq('tag', clanTag)
      .single();

    if (!clan) {
      return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });
    }

    // Fetch all settings for this clan
    const { data: rows, error } = await supabase
      .from('clan_settings')
      .select('key, value')
      .eq('clan_id', clan.id);

    if (error) throw error;

    // Convert rows to key-value object
    const settings = (rows || []).reduce((acc: any, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('[settings] GET failed', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clanTag = normalizeTag(body.clanTag || cfg.homeClanTag || '');
    const settings = body.settings;

    if (!clanTag || !settings) {
      return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    // Security check
    await requireRole(req, ['leader', 'coleader'], { clanTag });

    const supabase = getSupabaseServerClient();
    
    const { data: clan } = await supabase
      .from('clans')
      .select('id')
      .eq('tag', clanTag)
      .single();

    if (!clan) {
      return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });
    }

    // Upsert each setting
    // Note: In production we'd use a single RPC call for atomicity, 
    // but this works for development/prototyping.
    for (const [key, value] of Object.entries(settings)) {
      const { error } = await supabase
        .from('clan_settings')
        .upsert({
          clan_id: clan.id,
          key,
          value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'clan_id,key' });
        
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[settings] POST failed', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
