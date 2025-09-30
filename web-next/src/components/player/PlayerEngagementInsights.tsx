'use client';

import React from 'react';
import { PlayerEngagementInsight, PlayerNoteItem } from '@/lib/player-profile';
import SectionCard from '@/components/ui/SectionCard';

interface PlayerEngagementInsightsProps {
  insights: PlayerEngagementInsight[];
  notes: PlayerNoteItem[];
  actions: Array<{ id: string; label: string; description?: string; dueAt?: string }>;
}

export const PlayerEngagementInsights: React.FC<PlayerEngagementInsightsProps> = ({ insights, notes, actions }) => {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)]">
      <SectionCard title="Insights" subtitle="Highlights & alerts" className="section-card--sub">
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                insight.tone === 'positive'
                  ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100'
                  : insight.tone === 'warning'
                    ? 'border-amber-300/45 bg-amber-400/10 text-amber-100'
                    : 'border-white/15 bg-black/15 text-slate-100'
              }`}
            >
              <p className="font-semibold text-high-contrast">{insight.title}</p>
              <p className="text-sm text-slate-100/90">{insight.description}</p>
            </div>
          ))}
          {!insights.length && <p className="text-sm text-muted-contrast">No insights yet. Refresh Smart Insights to populate this section.</p>}
        </div>
      </SectionCard>

      <SectionCard title="Upcoming Actions" subtitle="Leadership follow-ups" className="section-card--sub">
        <div className="space-y-3">
          {actions.map((action) => (
            <div key={action.id} className="rounded-2xl border border-white/15 bg-black/15 px-4 py-3 text-sm text-slate-100">
              <p className="font-semibold text-high-contrast">{action.label}</p>
              {action.description ? <p className="text-sm text-slate-300">{action.description}</p> : null}
              {action.dueAt ? (
                <p className="text-xs text-muted-contrast">Due {Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(action.dueAt))}</p>
              ) : null}
            </div>
          ))}
          {!actions.length && <p className="text-sm text-muted-contrast">No action items yet.</p>}
        </div>
      </SectionCard>
    </div>
  );
};

export default PlayerEngagementInsights;
