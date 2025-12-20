import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { z } from 'zod';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { createApiContext } from '@/lib/api/route-helpers';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export interface JoinerNotification {
  id: string;
  playerTag: string;
  playerName: string | null;
  detectedAt: string;
  metadata: {
    hasPreviousHistory: boolean;
    hasNameChange: boolean;
    previousName: string | null;
    notesCount: number;
    warningsCount: number;
    totalTenure: number;
    lastDepartureDate: string | null;
    notificationPriority: 'low' | 'medium' | 'high' | 'critical';
  };
  history: any | null;
  notes: any[];
  warnings: any[];
}

export interface JoinerNotifications {
  critical: JoinerNotification[]; // Has warnings
  high: JoinerNotification[]; // Has notes or name change
  medium: JoinerNotification[]; // Has previous history
  low: JoinerNotification[]; // New player
  totalCount: number;
  hasNotifications: boolean;
}

// GET /api/joiners/notifications?clanTag=#TAG&days=7
export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/joiners/notifications');
  
  try {
    const { searchParams } = new URL(request.url);
    const Schema = z.object({
      clanTag: z.string(),
      days: z.coerce.number().optional().default(7),
    });
    
    const parsed = Schema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return json({ success: false, error: 'Clan tag is required' }, { status: 400 });
    }

    const clanTag = normalizeTag(parsed.data.clanTag);
    if (!clanTag || !isValidTag(clanTag)) {
      return json({ success: false, error: 'Provide a valid clanTag like #2PR8R8V8P' }, { status: 400 });
    }

    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `joiners:notifications:${clanTag}:${ip}`;
    const limit = await rateLimitAllow(key, { windowMs: 60_000, max: 30 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, {
        status: 429,
        headers: formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 30),
      });
    }

    const supabase = getSupabaseAdminClient();
    const days = parsed.data.days || 7;
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);

    // Fetch pending joiner events from last N days
    const { data: joinerEvents, error: joinerError } = await supabase
      .from('joiner_events')
      .select('*')
      .eq('clan_tag', clanTag)
      .eq('status', 'pending')
      .gte('detected_at', cutoff.toISOString())
      .order('detected_at', { ascending: false });

    if (joinerError) {
      throw new Error(`Failed to fetch joiner events: ${joinerError.message}`);
    }

    if (!joinerEvents || joinerEvents.length === 0) {
      return json({
        success: true,
        data: {
          critical: [],
          high: [],
          medium: [],
          low: [],
          totalCount: 0,
          hasNotifications: false,
        },
      });
    }

    const playerTags = joinerEvents.map((e) => e.player_tag);

    // Fetch player history
    const { data: historyRows, error: historyError } = await supabase
      .from('player_history')
      .select('*')
      .eq('clan_tag', clanTag)
      .in('player_tag', playerTags);

    if (historyError) {
      console.warn(`Failed to fetch player history: ${historyError.message}`);
    }

    // Fetch player notes
    const { data: notesRows, error: notesError } = await supabase
      .from('player_notes')
      .select('*')
      .eq('clan_tag', clanTag)
      .in('player_tag', playerTags)
      .order('created_at', { ascending: false });

    if (notesError) {
      console.warn(`Failed to fetch player notes: ${notesError.message}`);
    }

    // Fetch player warnings
    const { data: warningsRows, error: warningsError } = await supabase
      .from('player_warnings')
      .select('*')
      .eq('clan_tag', clanTag)
      .in('player_tag', playerTags)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (warningsError) {
      console.warn(`Failed to fetch player warnings: ${warningsError.message}`);
    }

    const historyMap = new Map((historyRows ?? []).map((h) => [h.player_tag, h]));
    const notesMap = new Map<string, any[]>();
    (notesRows ?? []).forEach((note) => {
      const tag = note.player_tag;
      if (!notesMap.has(tag)) {
        notesMap.set(tag, []);
      }
      notesMap.get(tag)!.push(note);
    });

    const warningsMap = new Map<string, any[]>();
    (warningsRows ?? []).forEach((warning) => {
      const tag = warning.player_tag;
      if (!warningsMap.has(tag)) {
        warningsMap.set(tag, []);
      }
      warningsMap.get(tag)!.push(warning);
    });

    // Build notifications with enriched data
    const notifications: JoinerNotification[] = joinerEvents.map((event) => {
      const metadata = (event.metadata as any) || {};
      const history = historyMap.get(event.player_tag) || null;
      const notes = notesMap.get(event.player_tag) || [];
      const warnings = warningsMap.get(event.player_tag) || [];

      // Override priority based on actual warnings count
      let priority: 'low' | 'medium' | 'high' | 'critical' = metadata.notificationPriority || 'low';
      if (warnings.length > 0) {
        priority = 'critical';
      } else if (notes.length > 0 || metadata.hasNameChange) {
        priority = 'high';
      } else if (metadata.hasPreviousHistory || history) {
        priority = 'medium';
      }

      return {
        id: event.id,
        playerTag: event.player_tag,
        playerName: metadata.name || null,
        detectedAt: event.detected_at,
        metadata: {
          hasPreviousHistory: metadata.hasPreviousHistory || !!history,
          hasNameChange: metadata.hasNameChange || false,
          previousName: metadata.previousName || history?.primary_name || null,
          notesCount: notes.length,
          warningsCount: warnings.length,
          totalTenure: metadata.totalTenure || history?.total_tenure || 0,
          lastDepartureDate: metadata.lastDepartureDate || null,
          notificationPriority: priority,
        },
        history,
        notes,
        warnings,
      };
    });

    // Group by priority
    const critical = notifications.filter((n) => n.metadata.notificationPriority === 'critical');
    const high = notifications.filter((n) => n.metadata.notificationPriority === 'high');
    const medium = notifications.filter((n) => n.metadata.notificationPriority === 'medium');
    const low = notifications.filter((n) => n.metadata.notificationPriority === 'low');

    // Sort: critical first (by warnings count), then high, medium, low
    critical.sort((a, b) => b.metadata.warningsCount - a.metadata.warningsCount);
    high.sort((a, b) => {
      if (a.metadata.hasNameChange !== b.metadata.hasNameChange) {
        return a.metadata.hasNameChange ? -1 : 1; // Name changes first
      }
      return b.metadata.notesCount - a.metadata.notesCount;
    });
    medium.sort((a, b) => b.metadata.totalTenure - a.metadata.totalTenure);
    low.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

    const result: JoinerNotifications = {
      critical,
      high,
      medium,
      low,
      totalCount: notifications.length,
      hasNotifications: notifications.length > 0,
    };

    return json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error checking joiner notifications:', error);
    return json(
      {
        success: false,
        error: error.message || 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

