"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Crown, Database, Palette, Settings, Users } from 'lucide-react';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import { Input } from '@/components/new-ui/Input';
import { useTheme } from '@/lib/contexts/theme-context';
import { cfg } from '@/lib/config';
import { useLeadership } from '@/hooks/useLeadership';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { apiFetcher } from '@/lib/api/swr-fetcher';
import useSWR from 'swr';
import { buildClanTagError, normalizeClanTagInput } from '@/lib/settings-helpers';

type TrackedClansResponse = {
  clans: string[];
};

const DENSITY_STORAGE_KEY = 'clash-intelligence-density';

export default function SettingsClient() {
  const { theme, setTheme } = useTheme();
  const { permissions } = useLeadership();
  const setClanTag = useDashboardStore((state) => state.setClanTag);
  const setHomeClan = useDashboardStore((state) => state.setHomeClan);
  const homeClan = useDashboardStore((state) => state.homeClan) || cfg.homeClanTag || '';
  const activeClan = useDashboardStore((state) => state.clanTag) || '';

  const [homeInput, setHomeInput] = useState(homeClan);
  const [activeInput, setActiveInput] = useState(activeClan);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [notice, setNotice] = useState<string | null>(null);
  const [trackedInput, setTrackedInput] = useState('');
  const [trackedNotice, setTrackedNotice] = useState<string | null>(null);

  const canManageTracked = permissions.canManageChangeDashboard || permissions.canManageAccess;
  const trackedClansKey = canManageTracked ? '/api/tracked-clans' : null;
  const { data: trackedData, error: trackedError, mutate: mutateTracked, isLoading: trackedLoading } =
    useSWR<TrackedClansResponse>(trackedClansKey, apiFetcher, {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    });

  const trackedClans = trackedData?.clans ?? [];

  useEffect(() => {
    setHomeInput(homeClan);
  }, [homeClan]);

  useEffect(() => {
    setActiveInput(activeClan);
  }, [activeClan]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(DENSITY_STORAGE_KEY);
    if (stored === 'compact' || stored === 'comfortable') {
      setDensity(stored);
      document.documentElement.setAttribute('data-density', stored);
    }
  }, []);

  const persistClanSettings = useCallback((nextHome: string, nextActive: string) => {
    if (typeof window === 'undefined') return;
    try {
      const existingRaw = window.localStorage.getItem('clan-settings');
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      window.localStorage.setItem(
        'clan-settings',
        JSON.stringify({
          ...existing,
          homeClan: nextHome || undefined,
          clanTag: nextActive || undefined,
        }),
      );
    } catch {
      // ignore localStorage issues
    }
  }, []);

  const handleSaveHomeClan = () => {
    const error = buildClanTagError(homeInput);
    if (error) {
      setNotice(error);
      return;
    }
    const normalized = normalizeClanTagInput(homeInput);
    if (!normalized) {
      setNotice('Enter a clan tag');
      return;
    }
    setHomeClan(normalized);
    persistClanSettings(normalized, activeClan);
    setNotice(`Home clan set to ${normalized}.`);
  };

  const handleSwitchClan = () => {
    const error = buildClanTagError(activeInput);
    if (error) {
      setNotice(error);
      return;
    }
    const normalized = normalizeClanTagInput(activeInput);
    if (!normalized) {
      setNotice('Enter a clan tag');
      return;
    }
    setClanTag(normalized);
    persistClanSettings(homeClan, normalized);
    setNotice(`Now viewing ${normalized}.`);
  };

  const handleDensityChange = (next: 'comfortable' | 'compact') => {
    setDensity(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
      document.documentElement.setAttribute('data-density', next);
    }
  };

  const handleAddTrackedClan = async () => {
    setTrackedNotice(null);
    const error = buildClanTagError(trackedInput);
    if (error) {
      setTrackedNotice(error);
      return;
    }
    const normalized = normalizeClanTagInput(trackedInput);
    if (!normalized) {
      setTrackedNotice('Enter a clan tag');
      return;
    }
    try {
      const response = await fetch('/api/tracked-clans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag: normalized }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || `Failed to add clan (${response.status})`);
      }
      setTrackedInput('');
      mutateTracked();
    } catch (err: any) {
      setTrackedNotice(err?.message || 'Failed to add clan');
    }
  };

  const handleRemoveTrackedClan = async (tag: string) => {
    setTrackedNotice(null);
    try {
      const response = await fetch(`/api/tracked-clans?clanTag=${encodeURIComponent(tag)}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || `Failed to remove clan (${response.status})`);
      }
      mutateTracked();
    } catch (err: any) {
      setTrackedNotice(err?.message || 'Failed to remove clan');
    }
  };

  const densityOptions = useMemo(
    () => [
      { value: 'comfortable' as const, label: 'Comfortable' },
      { value: 'compact' as const, label: 'Compact' },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
              <Settings className="h-4 w-4 text-clash-gold" />
              Settings
            </div>
            <h1 className="text-3xl font-semibold text-white">Clan configuration</h1>
            <p className="text-sm text-slate-400">
              Configure the clan focus for /new and set personal preferences. Permissions stay under Leadership.
            </p>
          </div>
        </div>
      </Card>

      {notice && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-emerald-200">
            <CheckCircle className="h-4 w-4" />
            {notice}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title={
            <div className="flex items-center gap-2 text-white">
              <Crown className="h-4 w-4 text-clash-gold" />
              Home clan
            </div>
          }
        >
          <div className="space-y-3">
            <Input
              value={homeInput}
              onChange={(event) => setHomeInput(event.target.value)}
              placeholder="#2PR8R8V8P"
            />
            <div className="flex items-center gap-2">
              <Button tone="primary" onClick={handleSaveHomeClan}>
                Save home clan
              </Button>
              <div className="text-xs text-slate-400">
                Current: <span className="font-mono text-slate-200">{homeClan || 'Not set'}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card
          title={
            <div className="flex items-center gap-2 text-white">
              <Users className="h-4 w-4 text-clash-gold" />
              Active clan context
            </div>
          }
        >
          <div className="space-y-3">
            <Input
              value={activeInput}
              onChange={(event) => setActiveInput(event.target.value)}
              placeholder="#2PR8R8V8P"
            />
            <div className="flex items-center gap-2">
              <Button tone="ghost" onClick={handleSwitchClan}>
                Switch clan
              </Button>
              <div className="text-xs text-slate-400">
                Viewing: <span className="font-mono text-slate-200">{activeClan || 'None'}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title={
            <div className="flex items-center gap-2 text-white">
              <Palette className="h-4 w-4 text-clash-gold" />
              Personal preferences
            </div>
          }
        >
          <div className="space-y-4 text-sm text-slate-300">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Theme</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['dark', 'light', 'system'] as const).map((option) => (
                  <Button
                    key={option}
                    tone={theme === option ? 'primary' : 'ghost'}
                    onClick={() => setTheme(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Density</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {densityOptions.map((option) => (
                  <Button
                    key={option.value}
                    tone={density === option.value ? 'primary' : 'ghost'}
                    onClick={() => handleDensityChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title={
            <div className="flex items-center gap-2 text-white">
              <Database className="h-4 w-4 text-clash-gold" />
              Tracked clans
            </div>
          }
        >
          {!canManageTracked ? (
            <div className="text-sm text-slate-400">
              Leader access is required to manage tracked clans.
            </div>
          ) : (
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={trackedInput}
                  onChange={(event) => setTrackedInput(event.target.value)}
                  placeholder="#2PR8R8V8P"
                />
                <Button tone="ghost" onClick={handleAddTrackedClan} disabled={trackedLoading}>
                  Add
                </Button>
              </div>
              {trackedNotice && (
                <div className="text-xs text-rose-300">{trackedNotice}</div>
              )}
              {trackedError && (
                <div className="text-xs text-rose-300">{trackedError.message}</div>
              )}
              {trackedLoading ? (
                <div className="text-xs text-slate-400">Loading tracked clans...</div>
              ) : trackedClans.length === 0 ? (
                <div className="text-xs text-slate-500">No tracked clans yet.</div>
              ) : (
                <div className="space-y-2">
                  {trackedClans.map((tag) => (
                    <div
                      key={tag}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                    >
                      <span className="font-mono text-sm text-slate-200">{tag}</span>
                      <Button tone="ghost" onClick={() => handleRemoveTrackedClan(tag)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
