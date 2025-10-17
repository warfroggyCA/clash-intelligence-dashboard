"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { normalizeTag } from '@/lib/tags';

interface PlayerNoteRecord {
  id: string;
  clan_tag: string;
  player_tag: string;
  player_name: string | null;
  note: string;
  custom_fields: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface RosterPlayerNotesModalProps {
  playerTag: string;
  playerName: string;
  clanTag: string;
  onClose: () => void;
}

interface DraftField {
  id: string;
  key: string;
  value: string;
}

export function RosterPlayerNotesModal({ playerTag, playerName, clanTag, onClose }: RosterPlayerNotesModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<PlayerNoteRecord[]>([]);
  const [noteText, setNoteText] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [customFields, setCustomFields] = useState<DraftField[]>([]);

  const normalizedClanTag = useMemo(() => normalizeTag(clanTag) ?? clanTag, [clanTag]);
  const normalizedPlayerTag = useMemo(() => normalizeTag(playerTag) ?? playerTag, [playerTag]);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        clanTag: normalizedClanTag,
        playerTag: normalizedPlayerTag,
        includeArchived: 'false',
      });
      const res = await fetch(`/api/player-notes?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load notes (${res.status})`);
      }
      const payload = await res.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Failed to load notes');
      }
      setNotes(payload.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [normalizedClanTag, normalizedPlayerTag]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const handleAddField = () => {
    setCustomFields((prev) => [...prev, { id: makeDraftId(), key: '', value: '' }]);
  };

  const handleUpdateField = (id: string, prop: 'key' | 'value', value: string) => {
    setCustomFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, [prop]: value } : field)),
    );
  };

  const handleRemoveField = (id: string) => {
    setCustomFields((prev) => prev.filter((field) => field.id !== id));
  };

  const handleCreateNote = async () => {
    if (!noteText.trim()) {
      setError('Please enter a note before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/player-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag: normalizedClanTag,
          playerTag: normalizedPlayerTag,
          playerName,
          note: noteText.trim(),
          customFields: customFields.reduce<Record<string, string>>((acc, field) => {
            if (field.key.trim()) {
              acc[field.key.trim()] = field.value.trim();
            }
            return acc;
          }, {}),
          createdBy: createdBy.trim() || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Failed to create note (${response.status})`);
      }

      setNoteText('');
      setCustomFields([]);
      await loadNotes();
    } catch (err: any) {
      setError(err.message || 'Failed to create note');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/player-notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          archivedBy: createdBy.trim() || 'System',
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Failed to archive note (${response.status})`);
      }
      await loadNotes();
    } catch (err: any) {
      setError(err.message || 'Failed to archive note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-950/90 border border-slate-700/70 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between border-b border-slate-700/70 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Leadership Notes</h2>
            <p className="text-sm text-slate-300/80">
              {playerName} • {normalizedPlayerTag}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Close notes modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-6">
          <section className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200">Note</label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Leader-only context, reminders, or history"
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-blue-500/60 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-200">Attributed To</label>
                <Input
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  placeholder="Your name or initials"
                  className="mt-1 border-slate-700/70 bg-slate-900/80 text-slate-100"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-200">Custom Fields</h3>
                <Button type="button" variant="ghost" size="sm" onClick={handleAddField}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {customFields.length === 0 && (
                  <p className="text-sm italic text-slate-400">No extra fields added.</p>
                )}
                {customFields.map((field) => (
                  <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Input
                      value={field.key}
                      onChange={(e) => handleUpdateField(field.id, 'key', e.target.value)}
                      placeholder="Field name"
                      className="border-slate-700/70 bg-slate-900/80 text-slate-100"
                    />
                    <Input
                      value={field.value}
                      onChange={(e) => handleUpdateField(field.id, 'value', e.target.value)}
                      placeholder="Value"
                      className="border-slate-700/70 bg-slate-900/80 text-slate-100"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveField(field.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCreateNote} disabled={saving}>
                {saving ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium uppercase tracking-wide text-slate-300">
              Existing Notes
            </h3>
            {loading ? (
              <p className="text-sm text-slate-400">Loading notes…</p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-slate-400">No leadership notes recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-4 text-sm text-slate-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="whitespace-pre-line text-slate-100">{note.note}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                          <span>{new Date(note.created_at).toLocaleString()}</span>
                          {note.created_by && <span>• by {note.created_by}</span>}
                        </div>
                        {note.custom_fields && Object.keys(note.custom_fields).length > 0 && (
                          <div className="mt-3 space-y-1">
                            {Object.entries(note.custom_fields).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between text-xs">
                                <span className="font-medium text-slate-300">{key}</span>
                                <span className="text-slate-400">{value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchive(note.id)}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default RosterPlayerNotesModal;
function makeDraftId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
