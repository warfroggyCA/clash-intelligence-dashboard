"use client";

import { useMemo, useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { AlertTriangle, RefreshCw, ShieldCheck, Users, Search, Clock, Archive, FileText, UserX, UserCheck, ChevronRight, MoreHorizontal, UserPlus } from 'lucide-react';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import { Input } from '@/components/new-ui/Input';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { normalizeSearch } from '@/lib/search';
import { safeLocaleDateString } from '@/lib/date';
import LeadershipGuard from '@/components/LeadershipGuard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Modal } from '@/components/ui/Modal';
import { showToast } from '@/lib/toast';
import { RosterPlayerNotesModal } from '@/components/leadership/RosterPlayerNotesModal';
import { RosterPlayerTenureModal } from '@/components/leadership/RosterPlayerTenureModal';
import { RosterPlayerDepartureModal } from '@/components/leadership/RosterPlayerDepartureModal';
import { resolveEffectiveTenureDays } from '@/lib/player-database/tenure';
import { buildAddPlayerNotePayload } from '@/lib/player-database/add-player';

// ═══════════════════════════════════════════════════════════════════════════════
// WORLD-CLASS COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Animated counter with easing
const AnimatedCounter = ({ value, duration = 800 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const displayValueRef = useRef(0);
  
  useEffect(() => {
    if (typeof value !== 'number' || isNaN(value)) return;
    const startTime = Date.now();
    const startValue = displayValueRef.current;
    const diff = value - startValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + diff * easeOut);
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return <>{displayValue.toLocaleString()}</>;
};

// Glow stat card with hover effects
const GlowStatCard = ({ 
  icon, 
  label, 
  value, 
  color = '#fff',
  subtext,
  pulse = false
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number | string; 
  color?: string;
  subtext?: string;
  pulse?: boolean;
}) => (
  <div 
    className="group relative flex flex-col items-center justify-center px-4 py-5 rounded-xl transition-all duration-300 hover:scale-105 overflow-hidden"
    style={{ 
      background: 'linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%)',
      border: `1px solid ${color}20`,
      boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 30px ${color}10`
    }}
  >
    {/* Ambient glow */}
    <div 
      className="absolute inset-0 opacity-30"
      style={{ 
        background: `radial-gradient(circle at 50% 0%, ${color}20 0%, transparent 60%)`,
      }}
    />
    
    {/* Glow effect on hover */}
    <div 
      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      style={{ 
        background: `radial-gradient(circle at 50% 50%, ${color}25 0%, transparent 70%)`,
      }}
    />
    
    <div className="relative z-10 flex items-center gap-3">
      <div 
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${pulse ? 'animate-pulse' : ''}`}
        style={{ 
          background: `${color}20`,
          boxShadow: `0 0 25px ${color}30`,
          filter: 'brightness(1.1) saturate(1.2)'
        }}
      >
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">{label}</div>
        <div 
          className="text-2xl font-black"
          style={{ color, textShadow: `0 0 25px ${color}50` }}
        >
          {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
        </div>
        {subtext && <div className="text-[10px] text-slate-500">{subtext}</div>}
      </div>
    </div>
  </div>
);

const SkeletonCard = ({ className }: { className?: string }) => (
  <div
    className={`rounded-xl border border-white/5 bg-white/5 p-4 animate-pulse ${className ?? ''}`}
  >
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-lg bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-white/10" />
        <div className="h-3 w-1/3 rounded bg-white/10" />
        <div className="h-3 w-1/2 rounded bg-white/10" />
      </div>
    </div>
  </div>
);

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
  townHallLevel?: number;
  tenureDays?: number | null;
  tenureAsOf?: string | null;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return res.json();
};

function PlayerDatabaseContent() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'current' | 'former'>('current');
  const [showArchived, setShowArchived] = useState(false);
  const [actionTarget, setActionTarget] = useState<PlayerRecord | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningText, setWarningText] = useState('');
  const [warningSaving, setWarningSaving] = useState(false);
  const [showMarkReturnedModal, setShowMarkReturnedModal] = useState(false);
  const [returnNoteText, setReturnNoteText] = useState('');
  const [returnTenureAward, setReturnTenureAward] = useState('');
  const [returnSaving, setReturnSaving] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showTenureModal, setShowTenureModal] = useState(false);
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [newPlayerTag, setNewPlayerTag] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNote, setNewPlayerNote] = useState('');
  const [addPlayerSaving, setAddPlayerSaving] = useState(false);

  const clanTag = normalizeTag(cfg.homeClanTag || '') || cfg.homeClanTag;

  const queryKey = clanTag
    ? `/api/player-database?clanTag=${encodeURIComponent(clanTag)}&includeArchived=${showArchived}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(queryKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });
  
  const handleRefresh = () => {
    mutate(undefined, { revalidate: true });
  };

  const openActions = (player: PlayerRecord) => {
    setActionTarget(player);
    setShowActionModal(true);
  };

  const handleSaveWarning = async () => {
    if (!actionTarget) return;
    if (!warningText.trim()) {
      showToast('Add a warning note before saving.', 'error');
      return;
    }
    if (!clanTag) {
      showToast('Missing clan tag.', 'error');
      return;
    }
    setWarningSaving(true);
    try {
      const response = await fetch('/api/player-warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag,
          playerTag: actionTarget.tag,
          playerName: actionTarget.name,
          warningNote: warningText.trim(),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Failed to save warning (${response.status})`);
      }
      setWarningText('');
      setShowWarningModal(false);
      showToast('Warning saved', 'success');
      await mutate();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save warning', 'error');
    } finally {
      setWarningSaving(false);
    }
  };

  const handleMarkReturned = async () => {
    if (!actionTarget) return;
    if (!clanTag) {
      showToast('Missing clan tag.', 'error');
      return;
    }
    setReturnSaving(true);
    try {
      const response = await fetch('/api/player-history/mark-returned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag,
          playerTag: actionTarget.tag,
          playerName: actionTarget.name,
          note: returnNoteText.trim() || undefined,
          awardPreviousTenure: returnTenureAward ? Number.parseInt(returnTenureAward, 10) : undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Failed to mark returned (${response.status})`);
      }
      setReturnNoteText('');
      setReturnTenureAward('');
      setShowMarkReturnedModal(false);
      showToast('Player marked as returned', 'success');
      await mutate();
    } catch (err: any) {
      showToast(err?.message || 'Failed to mark returned', 'error');
    } finally {
      setReturnSaving(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!clanTag) {
      showToast('Missing clan tag.', 'error');
      return;
    }
    const result = buildAddPlayerNotePayload({
      clanTag,
      playerTag: newPlayerTag,
      playerName: newPlayerName,
      note: newPlayerNote,
    });
    if (!result.payload || result.error) {
      showToast(result.error || 'Failed to prepare player payload.', 'error');
      return;
    }

    setAddPlayerSaving(true);
    try {
      const response = await fetch('/api/player-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.payload),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Failed to add player (${response.status})`);
      }
      showToast('Player added to database', 'success');
      closeAddPlayerModal();
      await mutate();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add player', 'error');
    } finally {
      setAddPlayerSaving(false);
    }
  };

  const resetAddPlayerForm = () => {
    setNewPlayerTag('');
    setNewPlayerName('');
    setNewPlayerNote('');
  };

  const closeAddPlayerModal = () => {
    resetAddPlayerForm();
    setShowAddPlayerModal(false);
  };

  const players: PlayerRecord[] = useMemo(() => data?.data ?? [], [data?.data]);
  const meta = data?.meta ?? {};

  const filteredPlayers = useMemo(() => {
    const term = normalizeSearch(search.trim());
    return players.filter((player) => {
      const name = normalizeSearch(player.name);
      const tag = normalizeSearch(player.tag);
      const notes = player.notes.map((note) => normalizeSearch(note.note));
      const warning = normalizeSearch(player.warning?.warningNote || '');

      const matchesSearch =
        !term ||
        name.includes(term) ||
        tag.includes(term) ||
        notes.some((note) => note.includes(term)) ||
        warning.includes(term);

      const matchesStatus =
        status === 'all' ||
        (status === 'current' && player.isCurrentMember) ||
        (status === 'former' && !player.isCurrentMember);

      return matchesSearch && matchesStatus;
    });
  }, [players, search, status]);

  const sortedPlayers = useMemo(() => {
    const list = [...filteredPlayers];
    list.sort((a, b) => {
      const aTenure = a.isCurrentMember ? resolveEffectiveTenureDays(a) : null;
      const bTenure = b.isCurrentMember ? resolveEffectiveTenureDays(b) : null;

      if (aTenure !== null && bTenure !== null) {
        return aTenure - bTenure; // newer first
      }
      if (aTenure !== null && bTenure === null) return -1;
      if (aTenure === null && bTenure !== null) return 1;

      const aUpdated = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
      const bUpdated = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
      return bUpdated - aUpdated;
    });
    return list;
  }, [filteredPlayers]);

  const activeWarnings = useMemo(
    () => filteredPlayers.filter((p) => p.warning?.isActive),
    [filteredPlayers]
  );

  const currentMembers = useMemo(
    () => players.filter((p) => p.isCurrentMember),
    [players]
  );

  const formerMembers = useMemo(
    () => players.filter((p) => !p.isCurrentMember),
    [players]
  );

  const totalNotes = useMemo(
    () => players.reduce((sum, p) => sum + p.notes.length, 0),
    [players]
  );

  const newestJoiner = useMemo(() => {
    const current = players.filter((p) => p.isCurrentMember);
    if (!current.length) return null;
    const withTenure = current
      .map((player) => ({ player, tenure: resolveEffectiveTenureDays(player) }))
      .filter((entry) => typeof entry.tenure === 'number');
    if (!withTenure.length) return current[0];
    return withTenure.reduce((latest, entry) => {
      if (latest.tenure == null) return entry;
      if (entry.tenure == null) return latest;
      return entry.tenure < latest.tenure ? entry : latest;
    }).player;
  }, [players]);

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════════════════
          HERO HEADER SECTION
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <div 
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.9) 50%, rgba(15,23,42,0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Background pattern */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 20%, rgba(234,179,8,0.15) 0%, transparent 40%),
              radial-gradient(circle at 80% 80%, rgba(168,85,247,0.1) 0%, transparent 40%),
              radial-gradient(circle at 50% 50%, rgba(59,130,246,0.08) 0%, transparent 50%)
            `,
          }}
        />
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 p-6 lg:p-8">
          {/* Title and actions */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 
                className="text-3xl lg:text-4xl font-black text-white mb-2 tracking-tight"
                style={{ 
                  fontFamily: 'var(--font-display)',
                  textShadow: '0 0 40px rgba(234,179,8,0.2)'
                }}
              >
                Player Database
              </h1>
              <p className="text-slate-400 text-sm">
                Notes, warnings, and history across current and former members
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                tone="primary"
                onClick={() => {
                  resetAddPlayerForm();
                  setShowAddPlayerModal(true);
                }}
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Add player
              </Button>
              <Button 
                tone="ghost" 
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                {showArchived ? 'Hide archived' : 'Show archived'}
              </Button>
              <Button 
                tone="accentAlt" 
                onClick={handleRefresh} 
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <GlowStatCard
              icon={<Users className="h-5 w-5 text-cyan-400" />}
              label="Players Tracked"
              value={meta.playerCount ?? players.length}
              color="#22d3ee"
            />
            <GlowStatCard
              icon={<UserCheck className="h-5 w-5 text-emerald-400" />}
              label="Current Members"
              value={currentMembers.length}
              color="#34d399"
            />
            <GlowStatCard
              icon={<AlertTriangle className="h-5 w-5 text-amber-400" />}
              label="Active Warnings"
              value={activeWarnings.length}
              color="#fbbf24"
              pulse={activeWarnings.length > 0}
            />
            <GlowStatCard
              icon={<FileText className="h-5 w-5 text-purple-400" />}
              label="Total Notes"
              value={totalNotes}
              color="#a78bfa"
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          SEARCH AND FILTERS
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <div 
        className="rounded-xl p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.8) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search players, tags, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-alt)]/50 focus:border-[var(--accent-alt)]/50 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <FilterChip
              active={status === 'all'}
              onClick={() => setStatus('all')}
              label="All"
              count={players.length}
            />
            <FilterChip
              active={status === 'current'}
              onClick={() => setStatus('current')}
              label="Active"
              count={currentMembers.length}
              color="#34d399"
            />
            <FilterChip
              active={status === 'former'}
              onClick={() => setStatus('former')}
              label="Former"
              count={formerMembers.length}
              color="#94a3b8"
            />
          </div>
          
          <div className="text-xs text-slate-500 ml-auto">
            Showing <span className="text-white font-semibold">{filteredPlayers.length}</span> of {players.length}
          </div>
        </div>
      </div>

      {/* Error display */}
      {error ? (
        <div 
          className="rounded-xl p-4 flex items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(185,28,28,0.1) 100%)',
            border: '1px solid rgba(239,68,68,0.3)',
          }}
        >
          <AlertTriangle className="h-5 w-5 text-rose-400" />
          <div>
            <div className="font-semibold text-rose-300">Failed to load player database</div>
            <div className="text-sm text-rose-200/80">{error.message}</div>
          </div>
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════════════
          MAIN CONTENT GRID
          ═══════════════════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Players List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-400" />
              Players
            </h2>
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            {isLoading && players.length === 0 ? (
              <>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <SkeletonCard key={`player-skel-${idx}`} />
                ))}
              </>
            ) : (
              sortedPlayers.map((player) => (
                <PlayerCard 
                  key={player.tag} 
                  player={player} 
                  onManage={() => openActions(player)}
                />
              ))
            )}
            {!isLoading && sortedPlayers.length === 0 && (
              <div 
                className="rounded-xl p-8 text-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.7) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <UserX className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <div className="text-slate-400">No players match these filters</div>
              </div>
            )}
          </div>
        </div>

        {/* Warnings Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Active Warnings
            </h2>
            <span 
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{
                background: activeWarnings.length > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(100,116,139,0.2)',
                color: activeWarnings.length > 0 ? '#fbbf24' : '#94a3b8',
              }}
            >
              {activeWarnings.length}
            </span>
          </div>
          
          <div className="space-y-3">
            {isLoading && players.length === 0 ? (
              <>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <SkeletonCard key={`warn-skel-${idx}`} />
                ))}
              </>
            ) : (
              activeWarnings.map((player) => (
                <WarningCard 
                  key={player.tag} 
                  player={player}
                  onClick={() => {
                    router.push(`/new/player/${encodeURIComponent(normalizeTag(player.tag) || player.tag)}`);
                  }}
                />
              ))
            )}
            {!activeWarnings.length && (
              <div 
                className="rounded-xl p-6 text-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.7) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <ShieldCheck className="h-8 w-8 text-emerald-500/50 mx-auto mb-2" />
                <div className="text-slate-500 text-sm">No active warnings</div>
                <div className="text-slate-600 text-xs mt-1">All clear! 🎉</div>
              </div>
            )}
          </div>

          {/* Recently Updated */}
          {newestJoiner && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Newest Joiner
              </h3>
              <div 
                className="rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.8) 100%)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
                onClick={() => {
                  router.push(`/new/player/${encodeURIComponent(normalizeTag(newestJoiner.tag) || newestJoiner.tag)}`);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{newestJoiner.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{newestJoiner.tag}</div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {(() => {
                      const tenure = resolveEffectiveTenureDays(newestJoiner);
                      return typeof tenure === 'number'
                        ? `Joined ${tenure} ${tenure === 1 ? 'day' : 'days'} ago`
                        : null;
                    })() ?? (newestJoiner.lastUpdated
                      ? formatDistanceToNow(new Date(newestJoiner.lastUpdated), { addSuffix: true })
                      : '—')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showActionModal && actionTarget ? (
        <Modal
          isOpen={showActionModal}
          onClose={() => setShowActionModal(false)}
          title="Player Actions"
          size="md"
        >
          <div className="space-y-4">
            <div className="text-sm text-slate-300">
              {actionTarget.name} • {actionTarget.tag}
            </div>
            <div className="grid gap-2">
              <Button tone="accentAlt" onClick={() => { setShowNotesModal(true); setShowActionModal(false); }}>
                Add Note
              </Button>
              <Button tone="ghost" onClick={() => { setShowWarningModal(true); setShowActionModal(false); }}>
                Add Warning
              </Button>
              <Button tone="ghost" onClick={() => { setShowTenureModal(true); setShowActionModal(false); }}>
                Update Tenure
              </Button>
              <Button tone="ghost" onClick={() => { setShowDepartureModal(true); setShowActionModal(false); }}>
                Record Departure
              </Button>
              <Button tone="ghost" onClick={() => { setShowMarkReturnedModal(true); setShowActionModal(false); }}>
                Mark Returned
              </Button>
              <Button tone="ghost" onClick={() => router.push(`/new/player/${encodeURIComponent(normalizeTag(actionTarget.tag) || actionTarget.tag)}`)}>
                View Profile
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showNotesModal && actionTarget ? (
        <RosterPlayerNotesModal
          playerTag={actionTarget.tag}
          playerName={actionTarget.name}
          clanTag={clanTag || ''}
          onClose={() => setShowNotesModal(false)}
        />
      ) : null}

      {showTenureModal && actionTarget ? (
        <RosterPlayerTenureModal
          playerTag={actionTarget.tag}
          playerName={actionTarget.name}
          clanTag={clanTag || ''}
          onSuccess={() => mutate()}
          onClose={() => setShowTenureModal(false)}
        />
      ) : null}

      {showDepartureModal && actionTarget ? (
        <RosterPlayerDepartureModal
          playerTag={actionTarget.tag}
          playerName={actionTarget.name}
          clanTag={clanTag || ''}
          onSuccess={() => mutate()}
          onClose={() => setShowDepartureModal(false)}
        />
      ) : null}

      <Modal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        title="Add warning"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Warnings are leadership-only and propagate to linked accounts.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-200">Warning note</label>
            <textarea
              value={warningText}
              onChange={(e) => setWarningText(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-cyan-500/60 focus:outline-none"
              placeholder="Capture the warning context..."
              disabled={warningSaving}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button tone="ghost" onClick={() => setShowWarningModal(false)} disabled={warningSaving}>
              Cancel
            </Button>
            <Button tone="accentAlt" onClick={handleSaveWarning} disabled={warningSaving || !warningText.trim()}>
              {warningSaving ? 'Saving...' : 'Save warning'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showMarkReturnedModal}
        onClose={() => setShowMarkReturnedModal(false)}
        title="Mark returned"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Record that this player rejoined. Optionally award prior tenure.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-200">Return note (optional)</label>
            <textarea
              value={returnNoteText}
              onChange={(e) => setReturnNoteText(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-cyan-500/60 focus:outline-none"
              placeholder="Context for leadership..."
              disabled={returnSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200">Award previous tenure (days)</label>
            <input
              type="number"
              min={0}
              value={returnTenureAward}
              onChange={(e) => setReturnTenureAward(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-cyan-500/60 focus:outline-none"
              placeholder="0"
              disabled={returnSaving}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button tone="ghost" onClick={() => setShowMarkReturnedModal(false)} disabled={returnSaving}>
              Cancel
            </Button>
            <Button tone="accentAlt" onClick={handleMarkReturned} disabled={returnSaving}>
              {returnSaving ? 'Saving...' : 'Mark returned'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAddPlayerModal}
        onClose={closeAddPlayerModal}
        title="Add player to database"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Add a player by tag and create an initial note for leadership.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-200">Player tag</label>
            <Input
              value={newPlayerTag}
              onChange={(e) => setNewPlayerTag(e.target.value)}
              placeholder="#2PR8R8V8P"
              disabled={addPlayerSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200">Player name (optional)</label>
            <Input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Player name"
              disabled={addPlayerSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200">Note (optional)</label>
            <textarea
              value={newPlayerNote}
              onChange={(e) => setNewPlayerNote(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-cyan-500/60 focus:outline-none"
              placeholder="Why are we adding this player?"
              disabled={addPlayerSaving}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button tone="ghost" onClick={closeAddPlayerModal} disabled={addPlayerSaving}>
              Cancel
            </Button>
            <Button tone="accentAlt" onClick={handleAddPlayer} disabled={addPlayerSaving || !newPlayerTag.trim()}>
              {addPlayerSaving ? 'Adding...' : 'Add player'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function PlayerCard({ 
  player, 
  onManage,
}: { 
  player: PlayerRecord; 
  onManage: () => void;
}) {
  const router = useRouter();
  const hasWarning = player.warning?.isActive;
  const noteCount = player.notes.length;
  const playerUrl = `/new/player/${encodeURIComponent(normalizeTag(player.tag) || player.tag)}`;
  const effectiveTenureDays = resolveEffectiveTenureDays(player);
  
  const handleCardClick = () => {
    router.push(playerUrl);
  };
  
  return (
    <div
      onClick={handleCardClick}
      className="group relative rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5"
      style={{ 
        background: hasWarning 
          ? 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(30,41,59,0.9) 30%, rgba(15,23,42,0.95) 100%)'
          : 'linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%)',
        border: hasWarning 
          ? '1px solid rgba(251,191,36,0.2)' 
          : '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}
    >
      {/* Hover glow */}
      <div 
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle at 50% 0%, rgba(234,179,8,0.08) 0%, transparent 60%)',
        }}
      />
      
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* TH Icon placeholder */}
          {player.townHallLevel ? (
            <TownHallIcon level={player.townHallLevel} size="md" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <Users className="h-5 w-5 text-slate-600" />
            </div>
          )}
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-white group-hover:text-[var(--accent-alt)] transition-colors truncate">
                {player.name || 'Unknown'}
              </span>
              <StatusBadge current={!!player.isCurrentMember} />
              {hasWarning && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                  ⚠️ Warning
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-slate-500 mt-0.5">{player.tag}</div>
            
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {noteCount} {noteCount === 1 ? 'note' : 'notes'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {player.isCurrentMember && typeof effectiveTenureDays === 'number'
                  ? `Joined ${effectiveTenureDays} ${effectiveTenureDays === 1 ? 'day' : 'days'} ago`
                  : (player.lastUpdated
                    ? `Last seen ${formatDistanceToNow(new Date(player.lastUpdated), { addSuffix: true })}`
                    : '—')}
              </span>
              {player.linkedAccounts?.length ? (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {player.linkedAccounts.length} linked
                </span>
              ) : null}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onManage();
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
          >
            <span className="flex items-center gap-1">
              <MoreHorizontal className="h-3.5 w-3.5" />
              Actions
            </span>
          </button>
          <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
        </div>
      </div>
      
      {/* Preview of most recent note */}
      {noteCount > 0 && (
        <div 
          className="mt-3 pt-3 border-t border-white/5 text-xs text-slate-400 line-clamp-2"
        >
          <span className="text-slate-500">Latest note:</span> {player.notes[player.notes.length - 1]?.note || '—'}
        </div>
      )}
    </div>
  );
}

function WarningCard({ player, onClick }: { player: PlayerRecord; onClick: () => void }) {
  const router = useRouter();
  const playerUrl = `/new/player/${encodeURIComponent(normalizeTag(player.tag) || player.tag)}`;
  
  const handleCardClick = () => {
    router.push(playerUrl);
  };
  
  return (
    <div
      onClick={handleCardClick}
      className="group rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.05) 100%)',
        border: '1px solid rgba(251,191,36,0.3)',
        boxShadow: '0 0 20px rgba(251,191,36,0.1)'
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-amber-100">{player.name}</span>
        <span className="font-mono text-xs text-amber-300/70">{player.tag}</span>
      </div>
      <div className="text-sm text-amber-100/80 line-clamp-3">
        {player.warning?.warningNote || 'Warning on file'}
      </div>
      {player.warning?.timestamp && (
        <div className="mt-2 text-[10px] text-amber-300/50">
          Since {formatDistanceToNow(new Date(player.warning.timestamp), { addSuffix: true })}
        </div>
      )}
    </div>
  );
}

function FilterChip({ 
  active, 
  label, 
  onClick, 
  count,
  color = '#eab308'
}: { 
  active: boolean; 
  label: string; 
  onClick: () => void;
  count?: number;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105"
      style={{
        background: active ? color : 'rgba(255,255,255,0.05)',
        color: active ? '#0f172a' : '#94a3b8',
        boxShadow: active ? `0 0 20px ${color}40` : 'none',
      }}
    >
      {label}
      {count !== undefined && (
        <span 
          className="px-1.5 py-0.5 rounded-full text-[10px]"
          style={{
            background: active ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatusBadge({ current }: { current: boolean }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{
        background: current ? 'rgba(52,211,153,0.2)' : 'rgba(100,116,139,0.2)',
        color: current ? '#34d399' : '#94a3b8',
      }}
    >
      {current ? 'Current' : 'Former'}
    </span>
  );
}

export default function PlayerDatabase() {
  const previewBypass =
    process.env.NEXT_PUBLIC_LEADERSHIP_PREVIEW === 'true' ||
    (typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(window.location.hostname));

  if (previewBypass) {
    return <PlayerDatabaseContent />;
  }

  return (
    <LeadershipGuard requiredPermission="canViewLeadershipFeatures">
      <PlayerDatabaseContent />
    </LeadershipGuard>
  );
}
