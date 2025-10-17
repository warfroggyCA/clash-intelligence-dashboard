"use client";

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { normalizeTag } from '@/lib/tags';

interface RosterPlayerTenureModalProps {
  playerTag: string;
  playerName: string;
  clanTag: string;
  defaultAction?: 'granted' | 'revoked';
  onSuccess?: () => void;
  onClose: () => void;
}

export function RosterPlayerTenureModal({
  playerTag,
  playerName,
  clanTag,
  defaultAction = 'granted',
  onSuccess,
  onClose,
}: RosterPlayerTenureModalProps) {
  const [action, setAction] = useState<'granted' | 'revoked'>(defaultAction);
  const [reason, setReason] = useState('');
  const [grantedBy, setGrantedBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedClanTag = useMemo(() => normalizeTag(clanTag) ?? clanTag, [clanTag]);
  const normalizedPlayerTag = useMemo(() => normalizeTag(playerTag) ?? playerTag, [playerTag]);

  const handleSubmit = async () => {
    if (!grantedBy.trim()) {
      setError('Please add your name so other leaders know who recorded this change.');
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
          actionType: 'tenure',
          createdBy: grantedBy.trim(),
          actionData: {
            action,
            reason: reason.trim() || null,
            grantedBy: grantedBy.trim(),
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Failed to record tenure (${response.status})`);
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record tenure action');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-950/90 border border-slate-700/70 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between border-b border-slate-700/70 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Update Tenure</h2>
            <p className="text-sm text-slate-300/80">
              {playerName} • {normalizedPlayerTag}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Close tenure modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-sm font-medium text-slate-200">Action</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(['granted', 'revoked'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAction(value)}
                  className={`rounded-lg border px-4 py-2 text-sm transition ${
                    action === value
                      ? 'border-blue-500/60 bg-blue-500/10 text-blue-200'
                      : 'border-slate-700/70 bg-slate-900/80 text-slate-300 hover:border-blue-500/40 hover:text-slate-100'
                  }`}
                >
                  {value === 'granted' ? 'Grant Tenure' : 'Revoke Tenure'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Context for leadership (optional)"
              className="w-full rounded-md border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-blue-500/60 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200">Recorded By *</label>
            <Input
              value={grantedBy}
              onChange={(e) => setGrantedBy(e.target.value)}
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

export default RosterPlayerTenureModal;
