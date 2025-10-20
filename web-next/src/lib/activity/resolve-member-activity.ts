import type {
  ActivityEvidence,
  ActivityLevel,
  Member,
  PlayerActivityTimelineEvent,
} from '@/types';
import { getMemberActivity } from '@/lib/business/calculations';

const scoreToLevel = (score: number): ActivityLevel => {
  if (score >= 70) return 'Very Active';
  if (score >= 45) return 'Active';
  if (score >= 28) return 'Moderate';
  if (score >= 15) return 'Low';
  return 'Inactive';
};

/**
 * Resolve the activity evidence for a roster member, preferring the
 * payload returned by the data spine but falling back to a local calculation
 * when needed.
 */
export function resolveMemberActivity(member: Member): ActivityEvidence {
  if (member.activity) {
    return member.activity;
  }

  const timeline =
    Array.isArray((member as any)?.activityTimeline)
      ? ((member as any).activityTimeline as PlayerActivityTimelineEvent[])
      : Array.isArray((member.extras as any)?.activityTimeline)
        ? ((member.extras as any).activityTimeline as PlayerActivityTimelineEvent[])
        : undefined;

  if (timeline && timeline.length) {
    return getMemberActivity(member, { timeline, lookbackDays: 7 });
  }

  if (typeof member.activityScore === 'number') {
    const rounded = Math.max(0, Math.round(member.activityScore));
    return {
      last_active_at:
        typeof member.lastSeen === 'string'
          ? member.lastSeen
          : new Date().toISOString(),
      confidence: 'medium',
      indicators: [],
      score: rounded,
      level: scoreToLevel(rounded),
      breakdown: undefined,
      metrics: undefined,
      lookbackDays: undefined,
      evidence: undefined,
    };
  }

  return getMemberActivity(member);
}
