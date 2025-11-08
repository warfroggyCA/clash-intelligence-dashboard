import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Backfill endpoint to copy saved applicant evaluations to Player Database.
 * This migrates existing evaluations from applicant_evaluations table to player_notes.
 */
export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
    
    if (expectedToken && expectedToken !== 'your-admin-api-key' && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // In local dev with placeholder, skip auth check (for development only)
    if (!expectedToken || expectedToken === 'your-admin-api-key') {
      // Allow in development - remove this in production!
      console.warn('[Backfill] Running without auth check (development mode)');
    }

    const body = await request.json().catch(() => ({}));
    const clanTagParam = body.clanTag || cfg.homeClanTag;
    const dryRun = body.dryRun !== false; // Default to dry run for safety
    
    if (!clanTagParam) {
      return NextResponse.json({ 
        success: false, 
        error: 'clanTag is required' 
      }, { status: 400 });
    }

    const clanTag = normalizeTag(clanTagParam);
    const supabase = getSupabaseAdminClient();

    // Step 1: Fetch all applicant evaluations for this clan
    const { data: evaluations, error: fetchError } = await supabase
      .from('applicant_evaluations')
      .select('*')
      .eq('clan_tag', clanTag)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[Backfill] Error fetching evaluations:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: `Failed to fetch evaluations: ${fetchError.message}` 
      }, { status: 500 });
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No evaluations found to backfill',
        stats: {
          total: 0,
          processed: 0,
          skipped: 0,
          created: 0,
        }
      });
    }

    console.log(`[Backfill] Found ${evaluations.length} evaluations to process`);

    // Step 2: Check which ones already have notes in Player Database
    const playerTags = evaluations.map(e => e.player_tag);
    const { data: existingNotes, error: notesError } = await supabase
      .from('player_notes')
      .select('player_tag, created_at')
      .eq('clan_tag', clanTag)
      .in('player_tag', playerTags);

    if (notesError) {
      console.error('[Backfill] Error checking existing notes:', notesError);
      return NextResponse.json({ 
        success: false, 
        error: `Failed to check existing notes: ${notesError.message}` 
      }, { status: 500 });
    }

    const existingTagsSet = new Set(
      (existingNotes || []).map(n => n.player_tag)
    );

    // Step 3: Process each evaluation
    const stats = {
      total: evaluations.length,
      processed: 0,
      skipped: 0,
      created: 0,
      errors: [] as string[],
    };

    const notesToCreate: any[] = [];

    for (const evalRecord of evaluations) {
      stats.processed++;

      // Check if this player already has a note
      const hasExistingNote = existingTagsSet.has(evalRecord.player_tag);
      
      // Skip if note already exists (unless you want to create additional notes)
      if (hasExistingNote) {
        stats.skipped++;
        continue;
      }

      // Build evaluation note text
      const evaluation = evalRecord.evaluation || {};
      const breakdown = evaluation.breakdown || [];
      const breakdownSummary = breakdown
        .map((b: any) => `${b.category}: ${b.points}/${b.maxPoints} - ${b.details}`)
        .join('\n');

      const evaluationNote = `Applicant Evaluation - Score: ${evalRecord.score || 'N/A'}/100 (${evalRecord.recommendation || 'N/A'})\n\n${breakdownSummary}`;

      // Extract applicant data for custom fields
      const applicant = evalRecord.applicant || {};
      
      notesToCreate.push({
        clan_tag: clanTag,
        player_tag: evalRecord.player_tag,
        player_name: evalRecord.player_name || applicant.name || null,
        note: evaluationNote,
        custom_fields: {
          evaluation_score: evalRecord.score,
          evaluation_recommendation: evalRecord.recommendation,
          evaluation_type: 'applicant_evaluation',
          evaluation_status: evalRecord.status,
          rush_percent: evalRecord.rush_percent,
          town_hall_level: applicant.townHallLevel,
          trophies: applicant.trophies,
          migrated_from: 'applicant_evaluations',
          original_created_at: evalRecord.created_at,
        },
        created_by: 'System (Backfill)',
        created_at: evalRecord.created_at, // Preserve original creation date
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'DRY RUN - No data was modified',
        stats: {
          ...stats,
          wouldCreate: notesToCreate.length,
        },
        preview: notesToCreate.slice(0, 3).map(n => ({
          player_tag: n.player_tag,
          player_name: n.player_name,
          note_preview: n.note.substring(0, 100) + '...',
        })),
        instructions: 'Set "dryRun": false in the request body to actually create the notes',
      });
    }

    // Step 4: Insert notes in batches
    if (notesToCreate.length > 0) {
      // Insert in batches of 50 to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < notesToCreate.length; i += batchSize) {
        const batch = notesToCreate.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('player_notes')
          .insert(batch);

        if (insertError) {
          console.error(`[Backfill] Error inserting batch ${i / batchSize + 1}:`, insertError);
          stats.errors.push(`Batch ${i / batchSize + 1}: ${insertError.message}`);
        } else {
          stats.created += batch.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfill completed: ${stats.created} notes created, ${stats.skipped} skipped`,
      stats,
      errors: stats.errors.length > 0 ? stats.errors : undefined,
    });
  } catch (error: any) {
    console.error('[Backfill] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unexpected error during backfill' 
    }, { status: 500 });
  }
}

