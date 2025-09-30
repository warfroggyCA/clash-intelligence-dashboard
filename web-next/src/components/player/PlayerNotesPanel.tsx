'use client';

import React from 'react';
import type { PlayerNoteItem } from '@/lib/player-profile';
import SectionCard from '@/components/ui/SectionCard';

interface PlayerNotesPanelProps {
  notes: PlayerNoteItem[];
}

export const PlayerNotesPanel: React.FC<PlayerNotesPanelProps> = ({ notes }) => {
  return (
    <SectionCard title="Leadership Notes" subtitle="Shared context & history" className="section-card--sub">
      <div className="space-y-3">
        {notes.map((note) => (
          <article key={note.id} className="rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-slate-100">
            <header className="flex items-center justify-between text-xs text-muted-contrast">
              <span className="font-semibold text-high-contrast">{note.author}</span>
              <time dateTime={note.createdAt}>{Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(note.createdAt))}</time>
            </header>
            <p className="mt-2 text-sm leading-relaxed text-slate-100/90">{note.content}</p>
            {note.tags?.length ? (
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-blue-200/80">
                {note.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-blue-200/50 bg-blue-500/10 px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
        {!notes.length && <p className="text-sm text-muted-contrast">No notes yet. Start a discussion from the command rail or Discord embed.</p>}
      </div>
    </SectionCard>
  );
};

export default PlayerNotesPanel;
