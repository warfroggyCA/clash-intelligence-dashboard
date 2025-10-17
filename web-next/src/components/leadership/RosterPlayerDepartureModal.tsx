"use client";

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { normalizeTag } from '@/lib/tags';

type DepartureType = 'voluntary' | 'involuntary' | 'inactive';

interface RosterPlayerDepartureModalProps {
  playerTag: string;
  playerName: string;
  clanTag: string;
  onSuccess?: () => void;
  onClose: () => void;
}

export function RosterPlayerDepartureModal({
  playerTag,
  playerName,
  clanTag,
  onSuccess,
  onClose,
}: RosterPlayerDepartureModalProps) {
  const [departureType, setDepartureType] = useState<DepartureType>('voluntary');
  const [reason, setReason] = useState('');
  const [recordedBy, setRecordedBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedClanTag = useMemo(() => normalizeTag(clanTag) ?? clanTag, [clanTag]);
  const normalizedPlayerTag = useMemo(() => normalizeTag(playerTag) ?? playerTag, [playerTag]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please provide a short reason so other leaders understand the context.');
      return;
    }
    if (!recordedBy.trim()) {
      setError('Please add your name so this action is attributed.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/player-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag: normalizedClanTag,
          playerTag: normalizedPlayerTag,
          playerName,
          actionType: 'departure',
          createdBy: recordedBy.trim(),
          actionData: {
            reason: reason.trim(),
            departureType,
            recordedBy: recordedBy.trim(),
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Failed to record departure (${response.status})`);
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record departure');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-950/90 border border-slate-700/70 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between border-b border-slate-700/70 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Record Departure</h2>
            <p className="text-sm text-slate-300/80">
              {playerName} • {normalizedPlayerTag}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Close departure modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-sm font-medium text-slate-200">Departure Type</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(['voluntary', 'involuntary', 'inactive'] as DepartureType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDepartureType(type)}
                  className={`rounded-lg border px-4 py-2 text-sm transition ${
                    departureType === type
                      ? 'border-orange-500/60 bg-orange-500/10 text-orange-200'
                      : 'border-slate-700/70 bg-slate-900/80 text-slate-300 hover:border-orange-500/40 hover:text-slate-100'
                  }`}
                >
                  {type === 'voluntary'
                    ? 'Voluntary Exit'
                    : type === 'involuntary'
                      ? 'Kicked (Other)'
                      : 'Kicked (Inactive)'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Short explanation for leadership history"
              className="w-full rounded-md border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200">Recorded By *</label>
            <Input
              value={recordedBy}
              onChange={(e) => setRecordedBy(e.target.value)}
              placeholder="Your name or initials"
              className="mt-1 border-slate-700/70 bg-slate-900/80 text-slate-100"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RosterPlayerDepartureModal;
