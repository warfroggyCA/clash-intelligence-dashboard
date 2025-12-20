"use client";

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { Card } from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import { Input } from '@/components/new-ui/Input';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { safeLocaleDateString } from '@/lib/date';
import LeadershipGuard from '@/components/LeadershipGuard';

type PlayerNote = {
  note: string;
  timestamp: string;
};

type PlayerWarning = {
  warningNote: string;
  isActive: boolean;
  timestamp?: string;
};

type LinkedAccount = {
  tag: string;
  name?: string;
  membershipStatus?: 'current' | 'former' | 'never';
};

type PlayerRecord = {
  tag: string;
  name: string;
  notes: PlayerNote[];
  warning?: PlayerWarning;
  lastUpdated: string;
  isCurrentMember?: boolean;
  linkedAccounts?: LinkedAccount[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return res.json();
};

export default function PlayerDatabase() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'current' | 'former'>('all');
  const [showArchived, setShowArchived] = useState(false);

  const clanTag = normalizeTag(cfg.homeClanTag || '') || cfg.homeClanTag;

  const queryKey = clanTag
    ? `/api/player-database?clanTag=${encodeURIComponent(clanTag)}&includeArchived=${showArchived}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(queryKey, fetcher, {
    revalidateOnFocus: false,
  });

  const players: PlayerRecord[] = data?.data ?? [];
  const meta = data?.meta ?? {};

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players.filter((player) => {
      const matchesSearch =
        !term ||
        player.name.toLowerCase().includes(term) ||
        player.tag.toLowerCase().includes(term) ||
        player.notes.some((note) => note.note.toLowerCase().includes(term)) ||
        (player.warning?.warningNote || '').toLowerCase().includes(term);

      const matchesStatus =
        status === 'all' ||
        (status === 'current' && player.isCurrentMember) ||
        (status === 'former' && !player.isCurrentMember);

      return matchesSearch && matchesStatus;
    });
  }, [players, search, status]);

  const activeWarnings = useMemo(
    () => filteredPlayers.filter((p) => p.warning?.isActive),
    [filteredPlayers]
  );

  return (
    <LeadershipGuard>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-white">Player Database</h1>
            <p className="text-sm text-white/70">
              Notes, warnings, and history across current and former members.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button tone="ghost" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
            <Button tone="accentAlt" onClick={() => mutate()} disabled={isLoading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-4 w-4 text-cyan-300" />}
            label="Players tracked"
            value={meta.playerCount ?? players.length}
          />
          <StatCard
            icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />}
            label="Current members"
            value={players.filter((p) => p.isCurrentMember).length}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4 text-amber-300" />}
            label="Active warnings"
            value={activeWarnings.length}
          />
          <StatCard
            icon={<RefreshCw className="h-4 w-4 text-cyan-200" />}
            label="Last updated"
            value={
              players[0]?.lastUpdated
                ? safeLocaleDateString(players[0].lastUpdated)
                : '—'
            }
          />
        </div>

        <Card surface="panel" className="border-white/10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search players, tags, or notes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <FilterChip
                active={status === 'all'}
                onClick={() => setStatus('all')}
                label="All"
              />
              <FilterChip
                active={status === 'current'}
                onClick={() => setStatus('current')}
                label="Current"
              />
              <FilterChip
                active={status === 'former'}
                onClick={() => setStatus('former')}
                label="Former"
              />
            </div>
            <div className="text-xs text-white/60">
              {filteredPlayers.length} of {players.length} shown
            </div>
          </div>
        </Card>

        {error ? (
          <Card surface="card" className="border border-rose-400/30">
            <div className="flex items-center gap-3 text-rose-200">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="font-semibold">Failed to load player database</div>
                <div className="text-sm text-rose-100/80">{error.message}</div>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card surface="bg" className="lg:col-span-2">
            <div className="flex items-center justify-between pb-3">
              <div className="text-sm font-semibold text-white/80">Players</div>
              {isLoading && <div className="text-xs text-white/60">Loading...</div>}
            </div>
            <div className="space-y-3">
              {filteredPlayers.map((player) => (
                <div
                  key={player.tag}
                  className="rounded-xl border border-white/5 bg-white/5 px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-white">{player.name || 'Unknown'}</span>
                        <StatusBadge current={!!player.isCurrentMember} />
                      </div>
                      <div className="text-xs font-mono text-white/60">{player.tag}</div>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/70">
                        <span>Notes: {player.notes.length}</span>
                        <span>
                          Updated: {player.lastUpdated ? safeLocaleDateString(player.lastUpdated) : '—'}
                        </span>
                        {player.linkedAccounts?.length ? (
                          <span>Linked: {player.linkedAccounts.length}</span>
                        ) : null}
                      </div>
                    </div>
                    {player.warning?.isActive ? (
                      <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                        <div className="font-semibold">Warning</div>
                        <div className="line-clamp-2 text-amber-100">
                          {player.warning.warningNote || 'Active warning'}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {!isLoading && filteredPlayers.length === 0 ? (
                <div className="rounded-lg border border-white/5 bg-white/5 px-4 py-6 text-center text-sm text-white/70">
                  No players match these filters.
                </div>
              ) : null}
            </div>
          </Card>

          <Card surface="panel">
            <div className="flex items-center justify-between pb-3">
              <div className="text-sm font-semibold text-white/80">Active warnings</div>
              <div className="text-xs text-white/60">{activeWarnings.length}</div>
            </div>
            <div className="space-y-3">
              {activeWarnings.map((player) => (
                <div
                  key={player.tag}
                  className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2"
                >
                  <div className="flex items-center justify-between text-sm font-semibold text-amber-100">
                    <span>{player.name}</span>
                    <span className="font-mono text-xs text-amber-200">{player.tag}</span>
                  </div>
                  <div className="mt-1 text-xs text-amber-100/80 line-clamp-3">
                    {player.warning?.warningNote || 'Warning on file'}
                  </div>
                </div>
              ))}
              {!activeWarnings.length && (
                <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-4 text-center text-xs text-white/70">
                  No active warnings.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </LeadershipGuard>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card surface="panel">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-white/60">{label}</div>
          <div className="text-xl font-semibold text-white">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active ? 'bg-[var(--accent-alt)] text-slate-900' : 'bg-white/5 text-white hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ current }: { current: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        current ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-700 text-slate-200'
      }`}
    >
      {current ? 'Current' : 'Former'}
    </span>
  );
}
