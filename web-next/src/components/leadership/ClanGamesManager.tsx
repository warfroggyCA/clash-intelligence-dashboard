"use client";

import { useState } from 'react';
import { Button, Input, GlassCard } from '@/components/ui';
import { useLeadership } from '@/hooks/useLeadership';
import { useClanGamesHistory } from '@/hooks/useClanGamesHistory';
import { showToast } from '@/lib/toast';
import { cfg } from '@/lib/config';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag } from '@/lib/tags';
import type { ClanGamesSeasonEntry } from '@/types';
import { Trash2 } from 'lucide-react';

interface ClanGamesManagerProps {
  clanTag?: string | null;
}

export default function ClanGamesManager({ clanTag: propClanTag }: ClanGamesManagerProps) {
  const fallbackClan = useDashboardStore((state) => state.clanTag || state.homeClan || cfg.homeClanTag || null);
  const clanTag = propClanTag || fallbackClan;
  const normalizedTag = clanTag ? normalizeTag(clanTag) : null;
  const { permissions } = useLeadership();
  const canManage = Boolean(permissions.canManageNotes || permissions.canManageAccess || permissions.canManageDiscord);
  const { entries, refresh, isLoading } = useClanGamesHistory(normalizedTag, 20);

  const [seasonLabel, setSeasonLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalPoints, setTotalPoints] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!canManage || !normalizedTag) {
    return null;
  }

  const handleSubmit = async () => {
    if (!seasonLabel.trim() || !totalPoints.trim()) {
      showToast('Enter a season label and total points', 'error');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/clan-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          clanTag: normalizedTag,
          seasonLabel: seasonLabel.trim(),
          startDate: startDate || null,
          endDate: endDate || null,
          totalPoints: Number(totalPoints),
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to save clan games entry');
      }

      setSeasonLabel('');
      setStartDate('');
      setEndDate('');
      setTotalPoints('');
      setNotes('');
      await refresh();
      showToast('Clan Games entry recorded', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Failed to save clan games entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: ClanGamesSeasonEntry) => {
    if (!window.confirm(`Delete ${entry.label}?`)) return;
    setDeletingId(entry.id);
    try {
      const params = new URLSearchParams({ id: entry.id });
      if (normalizedTag) params.set('clanTag', normalizedTag);
      const response = await fetch(`/api/clan-games?${params.toString()}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to delete entry');
      }
      await refresh();
      showToast('Entry deleted', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Failed to delete entry', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <GlassCard
      title="Leader Controls"
      subtitle="Add the total points after each Clan Games event. Everyone can see the history; only leaders can edit."
      className="space-y-4"
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="text-xs font-semibold text-slate-300">
          Season label
          <Input
            value={seasonLabel}
            onChange={(event) => setSeasonLabel(event.target.value)}
            placeholder="e.g., September 2024"
            className="mt-1"
          />
        </label>
        <label className="text-xs font-semibold text-slate-300">
          Total points
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={totalPoints}
            onChange={(event) => setTotalPoints(event.target.value)}
            placeholder="50000"
            className="mt-1"
          />
        </label>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="text-xs font-semibold text-slate-300">
          Start date
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1" />
        </label>
        <label className="text-xs font-semibold text-slate-300">
          End date
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1" />
        </label>
      </div>
      <label className="text-xs font-semibold text-slate-300">
        Notes (optional)
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Rewards, number of members at max tier, etc."
          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
          rows={3}
        />
      </label>
      <div className="flex justify-end">
        <Button onClick={() => void handleSubmit()} disabled={saving || !seasonLabel || !totalPoints}>
          {saving ? 'Saving…' : 'Record Clan Games'}
        </Button>
      </div>

      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Recent entries</div>
        {isLoading && entries.length === 0 ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-slate-400">Nothing recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {entries.slice(0, 5).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-800/60 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-slate-100">{entry.label}</p>
                  <p className="text-xs text-slate-400">{entry.totalPoints.toLocaleString()} pts</p>
                </div>
                <button
                  onClick={() => void handleDelete(entry)}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-red-200 hover:bg-red-500/20"
                  disabled={deletingId === entry.id}
                  title="Delete entry"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassCard>
  );
}
