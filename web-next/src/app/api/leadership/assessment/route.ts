import { NextRequest } from 'next/server';
import { requireLeadership } from '@/lib/api/role-check';
import { createApiContext } from '@/lib/api/route-helpers';
import { cfg } from '@/lib/config';
import { runLeadershipAssessment, fetchLatestLeadershipAssessment } from '@/lib/leadership-assessment/engine';

export const dynamic = 'force-dynamic';

const isPreviewBypass =
  process.env.NEXT_PUBLIC_LEADERSHIP_PREVIEW === 'true' ||
  process.env.NODE_ENV === 'development';

export async function GET(request: NextRequest) {
  const { json } = createApiContext(request, '/api/leadership/assessment');

  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag') || cfg.homeClanTag;
    const run = searchParams.get('run') === 'true';
    const force = searchParams.get('force') === 'true';
    const daysBack = searchParams.get('daysBack') ? Number(searchParams.get('daysBack')) : undefined;
    const weeksBack = searchParams.get('weeksBack') ? Number(searchParams.get('weeksBack')) : undefined;
    const weightWar = searchParams.get('weightWar');
    const weightSocial = searchParams.get('weightSocial');
    const weightReliability = searchParams.get('weightReliability');
    const weights = (weightWar || weightSocial || weightReliability) ? {
      war: weightWar ? Number(weightWar) : undefined,
      social: weightSocial ? Number(weightSocial) : undefined,
      reliability: weightReliability ? Number(weightReliability) : undefined,
    } : undefined;

    if (!clanTag) {
      return json({ success: false, error: 'clanTag query parameter is required' }, { status: 400 });
    }

    if (!isPreviewBypass) {
      await requireLeadership(request, { clanTag });
    }

    if (run) {
      const result = await runLeadershipAssessment({
        clanTag,
        runType: 'on-demand',
        force,
        daysBack,
        weeksBack,
        weights,
      });
      return json({ success: true, data: result });
    }

    const latest = await fetchLatestLeadershipAssessment(clanTag);
    if (latest) {
      return json({ success: true, data: latest });
    }

    const fallback = await runLeadershipAssessment({
      clanTag,
      runType: 'on-demand',
      force: true,
      daysBack,
      weeksBack,
      weights,
    });

    return json({ success: true, data: fallback });
  } catch (error: any) {
    if (error instanceof Response) {
      const status = error.status;
      if (status === 401 || status === 403) {
        return error;
      }
    }

    console.error('[leadership-assessment] Error:', error);
    return json({
      success: false,
      error: error?.message || 'Failed to run leadership assessment',
    }, { status: error?.status || 500 });
  }
}

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/leadership/assessment');

  try {
    const body = await request.json().catch(() => ({}));
    const clanTag = body?.clanTag || cfg.homeClanTag;

    if (!clanTag) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }

    if (!isPreviewBypass) {
      await requireLeadership(request, { clanTag });
    }

    const result = await runLeadershipAssessment({
      clanTag,
      runType: body?.runType || 'manual',
      force: Boolean(body?.force),
      daysBack: body?.daysBack,
      weeksBack: body?.weeksBack,
      minWars: body?.minWars,
      minWeekends: body?.minWeekends,
      weights: body?.weights,
    });

    return json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof Response) {
      const status = error.status;
      if (status === 401 || status === 403) {
        return error;
      }
    }

    console.error('[leadership-assessment] Error:', error);
    return json({
      success: false,
      error: error?.message || 'Failed to run leadership assessment',
    }, { status: error?.status || 500 });
  }
}
