"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check, RefreshCw } from 'lucide-react';
import { normalizeTag } from '@/lib/tags';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { getRoleHeaders } from '@/lib/api/role-header';
import { formatDistanceToNow } from 'date-fns';
import { showToast } from '@/lib/toast';

interface TrackedClan {
  clanTag: string;
  clanName?: string;
  hasData: boolean;
  lastJobStatus?: 'pending' | 'running' | 'completed' | 'failed';
  lastJobAt?: string;
  lastSnapshotAt?: string;
  isStale: boolean;
  memberCount?: number;
}

export function ClanSwitcher() {
  const router = useRouter();
  const [trackedClans, setTrackedClans] = useState<TrackedClan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { clanTag, setClanTag, loadRoster, homeClan } = useDashboardStore();
  const currentClanTag = normalizeTag(clanTag || homeClan || '');

  const fetchTrackedClans = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tracked-clans/status', {
        headers: {
          ...getRoleHeaders(),
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setTrackedClans(result.data.statuses || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch tracked clans:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTrackedClans();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTrackedClans, 30000);
    return () => clearInterval(interval);
  }, [fetchTrackedClans]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectClan = async (selectedTag: string) => {
    const normalizedSelected = normalizeTag(selectedTag);
    if (normalizedSelected === currentClanTag) {
      setIsOpen(false);
      return;
    }

    console.log('[ClanSwitcher] Switching from', currentClanTag, 'to', normalizedSelected);

    try {
      // Update store state first - this will automatically persist to localStorage via subscription
      setClanTag(normalizedSelected);
      console.log('[ClanSwitcher] Set clanTag in store:', normalizedSelected);
      
      // Also explicitly save to localStorage to ensure it's persisted (store subscription handles this, but being explicit)
      localStorage.setItem('currentClanTag', normalizedSelected);
      // Set cookie for server-side reading
      document.cookie = `currentClanTag=${normalizedSelected}; path=/; max-age=31536000`; // 1 year
      console.log('[ClanSwitcher] Saved to localStorage and cookie:', normalizedSelected);

      // Load the roster for the new clan (force reload to ensure fresh data)
      console.log('[ClanSwitcher] Loading roster for:', normalizedSelected);
      await loadRoster(normalizedSelected, { force: true });
      console.log('[ClanSwitcher] Roster loaded successfully');
      
      // Verify the store has the correct clan tag
      const storeState = useDashboardStore.getState();
      console.log('[ClanSwitcher] Store state after load:', {
        clanTag: storeState.clanTag,
        rosterClanTag: storeState.roster?.clanTag,
        rosterClanName: storeState.roster?.clanName,
        memberCount: storeState.roster?.members?.length,
      });
      
      // Check if roster actually loaded for the correct clan
      const loadedClanTag = normalizeTag(storeState.roster?.clanTag || '');
      if (loadedClanTag !== normalizedSelected) {
        console.warn('[ClanSwitcher] Mismatch! Expected:', normalizedSelected, 'Got:', loadedClanTag);
        showToast(`Warning: Roster may not have loaded correctly. Expected ${normalizedSelected}, got ${loadedClanTag}`, 'error');
      }
      
      setIsOpen(false);
      const selectedClan = trackedClans.find(c => normalizeTag(c.clanTag) === normalizedSelected);
      const displayName = selectedClan?.clanName || selectedTag;
      showToast(`Switched to ${displayName}`, 'success');
      
      // Force a full page reload to ensure all components update with new clan
      window.location.href = '/';
    } catch (error: any) {
      console.error('[ClanSwitcher] Failed to switch clan:', error);
      showToast(error.message || 'Failed to switch clan', 'error');
    }
  };

  const currentClan = trackedClans.find(c => normalizeTag(c.clanTag) === currentClanTag);
  const statusColor = currentClan?.isStale
    ? 'text-red-400'
    : currentClan?.lastJobStatus === 'running'
    ? 'text-blue-400'
    : currentClan?.lastJobStatus === 'failed'
    ? 'text-red-400'
    : 'text-green-400';

  if (loading && trackedClans.length === 0) {
    return null; // Don't show anything while loading initially
  }

  if (trackedClans.length === 0) {
    return null; // Don't show if no tracked clans
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surfaceRaised/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition-colors hover:bg-brand-surfaceRaised"
        title="Switch between tracked clans"
      >
        <span className={`h-2 w-2 rounded-full ${statusColor || 'bg-slate-400'}`} />
        <span className="hidden sm:inline truncate max-w-[120px]">
          {currentClan?.clanName || currentClanTag}
        </span>
        <span className="sm:hidden">Clan</span>
        <ChevronDown className={`h-3 w-3 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-brand-border/80 bg-brand-surfaceRaised/95 p-2 text-xs shadow-[0_18px_32px_-24px_rgba(8,15,31,0.65)] max-h-[400px] overflow-y-auto">
          <div className="space-y-1">
            {trackedClans.map((clan) => {
              const isSelected = normalizeTag(clan.clanTag) === currentClanTag;
              const clanStatusColor = clan.isStale
                ? 'text-red-400'
                : clan.lastJobStatus === 'running'
                ? 'text-blue-400'
                : clan.lastJobStatus === 'failed'
                ? 'text-red-400'
                : 'text-green-400';

              return (
                <button
                  key={clan.clanTag}
                  onClick={() => void handleSelectClan(clan.clanTag)}
                  className={`flex w-full items-start justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-brand-surfaceSubtle text-white'
                      : 'text-slate-300 hover:bg-brand-surfaceSubtle/70 hover:text-white'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${clanStatusColor} flex-shrink-0`} />
                      <span className="font-semibold truncate">{clan.clanName || clan.clanTag}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                    </div>
                    {clan.clanName && (
                      <div className="mt-0.5 text-[10px] font-mono text-slate-400 truncate">
                        {clan.clanTag}
                      </div>
                    )}
                    {clan.lastJobAt && (
                      <div className="mt-1 text-[10px] text-slate-400">
                        {formatDistanceToNow(new Date(clan.lastJobAt), { addSuffix: true })}
                      </div>
                    )}
                    {clan.memberCount !== undefined && (
                      <div className="text-[10px] text-slate-400">
                        {clan.memberCount} members
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-brand-border/50">
            <button
              onClick={() => {
                void fetchTrackedClans();
                showToast('Refreshed clan status', 'success');
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-slate-300 transition-colors hover:bg-brand-surfaceSubtle/70 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Status
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

