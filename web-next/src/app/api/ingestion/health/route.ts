import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseServerClient } from '@/lib/supabase-server';

interface PhaseSummary {
  name: string;
  success: boolean;
  durationMs: number | null;
  rowDelta: number | null;
  errorMessage: string | null;
  metadata?: Record<string, any> | null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const searchParams = new URL(req.url).searchParams;
    const clanTagParam = searchParams.get('clanTag');
    const clanTag = clanTagParam ? normalizeTag(clanTagParam) : null;

    let query = supabase
      .from('ingestion_jobs')
      .select('id, clan_tag, status, created_at, updated_at, steps, logs, result, payload_version, ingestion_version, schema_version, total_duration_ms, anomalies, fetched_at, computed_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (clanTag) {
      query = query.eq('clan_tag', clanTag);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ success: false, error: 'No ingestion jobs found' }, { status: 404 });
    }

    const phasesRaw = ((data.steps ?? []) as any[]).reduce<Record<string, any>>((acc, step) => {
      acc[step.name] = step.metadata ? { ...step.metadata, success: step.success } : { success: step.success };
      return acc;
    }, {});
    const phases: PhaseSummary[] = Object.entries(phasesRaw).map(([name, value]) => {
      const phase = value as Record<string, any>;
      return {
        name,
        success: Boolean(phase.success),
        durationMs: typeof phase.duration_ms === 'number' ? phase.duration_ms : typeof phase.durationMs === 'number' ? phase.durationMs : null,
        rowDelta: typeof phase.row_delta === 'number' ? phase.row_delta : typeof phase.rowDelta === 'number' ? phase.rowDelta : null,
        errorMessage: typeof phase.error_message === 'string' ? phase.error_message : typeof phase.errorMessage === 'string' ? phase.errorMessage : null,
        metadata: typeof phase.metadata === 'object' && phase.metadata !== null ? phase.metadata : null,
      };
    });

    const totalDurationMs = phases.reduce((sum, phase) => sum + (phase.durationMs ?? 0), 0);

    const anomalies: Array<{ phase: string; message: string }> = [];
    phases.forEach((phase) => {
      if (!phase.success) {
        anomalies.push({ phase: phase.name, message: phase.errorMessage ?? 'Phase failed' });
      } else if (phase.name === 'upsertMembers' || phase.name === 'writeStats') {
        if (phase.rowDelta != null && phase.rowDelta === 0) {
          anomalies.push({ phase: phase.name, message: 'No rows updated' });
        }
      }
    });

    const writeSnapshotPhase = (phasesRaw.writeSnapshot ?? null) as Record<string, any> | null;
    const payloadVersion = data.payload_version
      ?? (typeof writeSnapshotPhase?.metadata?.payloadVersion === 'string' ? writeSnapshotPhase.metadata.payloadVersion : null);
    const snapshotId = writeSnapshotPhase?.metadata?.snapshotId ?? null;
    const fetchedAt = data.fetched_at ?? writeSnapshotPhase?.metadata?.fetchedAt ?? null;
    const computedAt = data.computed_at ?? writeSnapshotPhase?.metadata?.computedAt ?? null;
    const seasonId = writeSnapshotPhase?.metadata?.seasonId ?? null;

    const finishedAt = data.updated_at;
    const startedAt = data.created_at;
    const now = Date.now();
    const updatedAtMs = new Date(finishedAt ?? startedAt).getTime();
    const staleThresholdMs = 6 * 60 * 60 * 1000; // 6 hours
    const isStale = Number.isFinite(updatedAtMs) ? now - updatedAtMs > staleThresholdMs : false;

    return NextResponse.json({
      success: true,
      data: {
        jobId: data.id,
        clanTag: data.clan_tag,
        status: data.status,
        startedAt,
        finishedAt,
        totalDurationMs: data.total_duration_ms ?? totalDurationMs,
        phases,
        anomalies,
        stale: isStale,
        logs: (data.logs ?? []).slice(-15),
        payloadVersion,
        ingestionVersion: data.ingestion_version ?? null,
        schemaVersion: data.schema_version ?? null,
        snapshotId,
        fetchedAt,
        computedAt,
        seasonId,
      },
    });
  } catch (error: any) {
    console.error('[api/ingestion/health] error', error);
    return NextResponse.json({ success: false, error: error?.message ?? 'Internal Server Error' }, { status: 500 });
  }
}
