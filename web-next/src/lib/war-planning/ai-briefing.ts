import OpenAI from 'openai';
import type {
  WarPlanAnalysis,
  WarPlanBriefing,
  WarPlanProfile,
  WarPlanAIPayload,
  AttackOrderSuggestion,
} from './analysis';

const MODEL_NAME = process.env.WAR_PLANNING_AI_MODEL || 'gpt-4o-mini';

export interface EnhanceWarPlanContext {
  ourClanTag?: string | null;
  opponentClanTag?: string | null;
  ourProfiles: WarPlanProfile[];
  opponentProfiles: WarPlanProfile[];
}

export interface EnhanceWarPlanOptions {
  enabled?: boolean;
}

export async function enhanceWarPlanAnalysis(
  analysis: WarPlanAnalysis,
  context: EnhanceWarPlanContext,
  options: EnhanceWarPlanOptions = {},
): Promise<WarPlanAnalysis> {
  const payload: WarPlanAIPayload = {
    matchup: {
      ourClanTag: context.ourClanTag ?? null,
      opponentClanTag: context.opponentClanTag ?? null,
      confidence: analysis.summary.confidence,
      outlook: analysis.summary.outlook,
      metrics: analysis.metrics,
      recommendations: analysis.recommendations,
      slotHighlights: analysis.slotBreakdown.slice(0, 8).map((slot) => ({
        slot: slot.slot,
        matchup: `${slot.ourName ?? slot.ourTag ?? 'Unknown'} vs ${slot.opponentName ?? slot.opponentTag ?? 'Unknown'}`,
        summary: slot.summary,
        thDiff: slot.thDiff,
        heroDiff: slot.heroDiff,
        rankedDiff: slot.rankedDiff,
        warStarDiff: slot.warStarDiff,
      })),
    },
  };

  if (options.enabled === false || !process.env.OPENAI_API_KEY) {
    return { ...analysis, aiInput: payload };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an elite Clash of Clans war strategist. Produce concise, high-signal briefings for clan leaders preparing for war matchups. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `${JSON.stringify(
            payload,
          )}\n\nReturn a JSON object with keys: headline (string <= 100 chars), bullets (array of 3-6 punchy strategy insights), narrative (single paragraph), recommendations (array of 2-5 focused action items), optional confidenceBand (edge|balanced|underdog), and optional attackOrder (array up to 10 items, each { "slot": number, "reason": string <= 140 describing why that attacker should go at that point }). Do not include additional keys.`,
        },
      ],
      max_tokens: 700,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return analysis;
    }

    const parsed = JSON.parse(raw) as {
      headline?: string;
      bullets?: string[];
      narrative?: string;
      recommendations?: string[];
      confidenceBand?: string;
      attackOrder?: Array<{ slot?: number; reason?: string }>;
    };

    const attackOrder = Array.isArray(parsed.attackOrder)
      ? sanitizeAttackOrder(parsed.attackOrder)
      : null;

    const updated: WarPlanAnalysis = {
      ...analysis,
      aiInput: payload,
      briefing: buildBriefingFromAI(parsed, analysis.briefing),
      aiSuggestedOrder: attackOrder,
    };

    if (Array.isArray(parsed.recommendations) && parsed.recommendations.length) {
      updated.recommendations = parsed.recommendations.filter(Boolean).map((item) => item.trim()).slice(0, 6);
    }

    return updated;
  } catch (error) {
    console.warn('[WarPlanning] Failed to enhance briefing with OpenAI', error);
    return { ...analysis, aiInput: payload };
  }
}

function buildBriefingFromAI(parsed: any, fallback: WarPlanBriefing): WarPlanBriefing {
  const now = new Date().toISOString();
  const isValidBand =
    typeof parsed?.confidenceBand === 'string' &&
    ['edge', 'balanced', 'underdog'].includes(parsed.confidenceBand.toLowerCase());

  const bullets =
    Array.isArray(parsed?.bullets) && parsed.bullets.length
      ? parsed.bullets
          .map((item: unknown) => (typeof item === 'string' ? item.trim() : null))
          .filter((item: string | null): item is string => Boolean(item))
          .slice(0, 6)
      : fallback.bullets;

  return {
    headline: typeof parsed?.headline === 'string' && parsed.headline.trim().length
      ? parsed.headline.trim()
      : fallback.headline,
    bullets,
    narrative:
      typeof parsed?.narrative === 'string' && parsed.narrative.trim().length
        ? parsed.narrative.trim()
        : fallback.narrative,
    confidenceBand: isValidBand ? (parsed.confidenceBand.toLowerCase() as WarPlanBriefing['confidenceBand']) : fallback.confidenceBand,
    generatedAt: now,
    source: 'openai',
    model: MODEL_NAME,
  };
}

function sanitizeAttackOrder(
  entries: Array<{ slot?: number; reason?: string }>,
): AttackOrderSuggestion[] {
  const results: AttackOrderSuggestion[] = [];
  for (const entry of entries) {
    if (typeof entry?.slot !== 'number' || !Number.isFinite(entry.slot)) continue;
    results.push({
      slot: Math.max(1, Math.round(entry.slot)),
      reason: typeof entry.reason === 'string' ? entry.reason.trim().slice(0, 200) : undefined,
    });
    if (results.length >= 10) break;
  }
  return results;
}
