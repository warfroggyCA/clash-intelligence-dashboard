import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { generateChangeSummary } from '@/lib/ai-summarizer';

const performerSchema = z.object({
  name: z.string(),
  tag: z.string().optional(),
  stars: z.number().optional(),
  summary: z.string().optional(),
  townHallDelta: z.number().optional().nullable(),
});

const payloadSchema = z.object({
  clanTag: z.string(),
  clanName: z.string().optional(),
  war: z.object({
    opponentName: z.string().optional(),
    opponentTag: z.string().optional(),
    result: z.enum(['win', 'loss', 'draw']),
    ourStars: z.number(),
    opponentStars: z.number(),
    ourPercent: z.number().optional(),
    opponentPercent: z.number().optional(),
    warType: z.string().optional(),
    warId: z.string().optional(),
  }),
  topPerformers: z.array(performerSchema).optional(),
  bravest: performerSchema.optional(),
  rosterContext: z
    .object({
      memberCount: z.number().optional(),
      averageTownHall: z.number().optional(),
      recentWinRate: z.number().optional(),
      newMemberCount: z.number().optional(),
    })
    .optional(),
});

type WarSummaryPayload = z.infer<typeof payloadSchema>;

const formatPercent = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : undefined;

function buildPrompt(data: WarSummaryPayload): string {
  const {
    clanName,
    clanTag,
    war,
    topPerformers = [],
    bravest,
    rosterContext,
  } = data;

  const battleLine = [
    `Clan: ${clanName || clanTag}`,
    `Opponent: ${war.opponentName || war.opponentTag || 'Unknown'}`,
    `Result: ${war.result.toUpperCase()}`,
    `Score: ${war.ourStars}-${war.opponentStars}`,
    war.ourPercent != null && war.opponentPercent != null
      ? `Destruction: ${war.ourPercent.toFixed(1)}% vs ${war.opponentPercent.toFixed(1)}%`
      : null,
    war.warType ? `Format: ${war.warType}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const performerLines =
    topPerformers.length > 0
      ? topPerformers
          .map((perf, idx) => {
            const parts = [
              `${idx + 1}. ${perf.name}`,
              perf.summary ? `(${perf.summary})` : null,
              perf.stars != null ? `${perf.stars}★ total` : null,
              perf.townHallDelta != null && perf.townHallDelta !== 0
                ? `TH delta ${perf.townHallDelta > 0 ? `+${perf.townHallDelta}` : perf.townHallDelta}`
                : null,
            ].filter(Boolean);
            return parts.join(' ');
          })
          .join('\n')
      : 'No top performers recorded.';

  const bravestLine = bravest
    ? [
        `${bravest.name} (${bravest.summary || 'no summary'})`,
        bravest.townHallDelta != null && bravest.townHallDelta !== 0
          ? `TH delta ${bravest.townHallDelta > 0 ? `+${bravest.townHallDelta}` : bravest.townHallDelta}`
          : 'even TH matchup',
      ].join(' — ')
    : 'No bravest attack recorded.';

  const rosterLines = [
    rosterContext?.memberCount ? `Members: ${rosterContext.memberCount}` : null,
    rosterContext?.averageTownHall
      ? `Avg TH: ${rosterContext.averageTownHall.toFixed(2)}`
      : null,
    rosterContext?.recentWinRate != null
      ? `Recent win rate: ${rosterContext.recentWinRate.toFixed(1)}%`
      : null,
    rosterContext?.newMemberCount
      ? `New members in roster: ${rosterContext.newMemberCount}`
      : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return `
You are the clan leader posting a war recap in Discord. Provide 3 short bullets for the roster.

Tone & style:
- Sound like a confident leader speaking directly to clanmates.
- Keep each bullet punchy (1 sentence). Never start with "Learning" or numbered lists.
- Highlight what decided the result, shout-out top performers/brave attacks, and close with a forward-looking takeaway.
- Mention key names/opponents where it adds context. Avoid corporate or AI phrases.

War Summary:
${battleLine}

Top Performers:
${performerLines}

Bravest Attack:
${bravestLine}

Roster Context:
${rosterLines || 'No roster context.'}

Respond with exactly 3 bullets, each prefixed by "- ".
`;
}

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/ai-war-summary/generate');

  try {
    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      const errorDetails = parsed.error.flatten();
      return json(
        { 
          success: false, 
          error: 'Invalid request body',
          message: `Validation failed: ${JSON.stringify(errorDetails.fieldErrors)}`
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
    const key = `ai:war-summary:${payload.clanTag}:${ip}`;
    const limit = await rateLimitAllow(key, { windowMs: 60_000, max: 5 });
    if (!limit.ok) {
      return json(
        { success: false, error: 'Too many requests' },
        {
          status: 429,
          headers: formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 5),
        }
      );
    }

    const prompt = buildPrompt(payload);
    const summary = await generateChangeSummary([], payload.clanTag, new Date().toISOString(), prompt);
    const learnings = summary
      .split('\n')
      .map((line) => line.replace(/^[\-\*\•]\s*/, '').trim())
      .filter(Boolean);

    return json({
      success: true,
      data: {
        learnings,
        raw: summary,
      },
    });
  } catch (error: any) {
    console.error('[ai-war-summary] Failed to generate summary', error);
    return json({ success: false, error: 'Failed to generate war summary' }, { status: 500 });
  }
}
