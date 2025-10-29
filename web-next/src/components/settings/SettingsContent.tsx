"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { GlassCard } from '@/components/ui';
import { ElderAssessmentCard } from '@/components/settings/ElderAssessmentCard';
import { showToast } from '@/lib/toast';
import { useLeadership } from '@/hooks/useLeadership';
import { cfg } from '@/lib/config';
import type { ClanRoleName } from '@/lib/auth/roles';
import type { ClanRole } from '@/lib/leadership';
import { clearSmartInsightsPayload } from '@/lib/smart-insights-cache';
import {
  Settings,
  Shield,
  Key,
  RefreshCw,
  Home,
  Users,
  Palette,
  Bell,
  Database,
} from 'lucide-react';

export interface SettingsContentProps {
  layout?: 'page' | 'modal';
  onClose?: () => void;
}

interface RoleEntry {
  id?: string;
  userId: string;
  email: string | null;
  playerTag: string;
  role: ClanRoleName;
}

export default function SettingsContent({ layout = 'page', onClose }: SettingsContentProps) {
  const {
    homeClan,
    clanTag,
    setHomeClan,
    setClanTag,
    loadRoster,
    userRole,
    setUserRole,
    loadSmartInsights,
    setSmartInsights,
  } = useDashboardStore();

  const [newHomeClan, setNewHomeClan] = useState(homeClan || '');
  const [newClanTag, setNewClanTag] = useState(clanTag || '');
  const [newUserRole, setNewUserRole] = useState(userRole);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const [roleEntries, setRoleEntries] = useState<RoleEntry[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesMessage, setRolesMessage] = useState('');
  const [newRoleEmail, setNewRoleEmail] = useState('');
  const [newRoleTag, setNewRoleTag] = useState('');
  const [newRoleRole, setNewRoleRole] = useState<ClanRoleName>('member');
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const { permissions } = useLeadership();
  const effectiveClanTag = normalizeTag(clanTag || homeClan || newHomeClan || '#');

  useEffect(() => {
    setNewHomeClan(homeClan || '');
    setNewClanTag(clanTag || '');
    setNewUserRole(userRole);
  }, [homeClan, clanTag, userRole]);

  const handleSaveHomeClan = async () => {
    if (!newHomeClan.trim()) {
      setMessage('Please enter a clan tag');
      return;
    }
    const normalized = normalizeTag(newHomeClan);
    if (!isValidTag(normalized)) {
      setMessage('Please enter a valid clan tag (e.g., #2PR8R8V8P)');
      return;
    }
    setIsLoading(true);
    setMessage('');
    try {
      setHomeClan(normalized);
      setMessage('Home clan updated successfully!');
      if (!clanTag) {
        await loadRoster(normalized);
      }
    } catch (error) {
      console.error('Error updating home clan:', error);
      setMessage('Failed to update home clan');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoleEntries = useCallback(async () => {
    try {
      setRolesLoading(true);
      setRolesMessage('');
      const res = await fetch(`/api/admin/roles?clanTag=${encodeURIComponent(effectiveClanTag)}`);
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to load roles');
      }
      setRoleEntries(body.data.roles);
    } catch (error: any) {
      console.error('Failed to load role entries:', error);
      setRolesMessage(error?.message || 'Failed to load role entries');
    } finally {
      setRolesLoading(false);
    }
  }, [effectiveClanTag]);

  useEffect(() => {
    if (permissions.canManageAccess) {
      void loadRoleEntries();
    }
  }, [permissions.canManageAccess, loadRoleEntries]);

  const updateRoleEntry = (id: string | undefined, updates: Partial<RoleEntry>) => {
    if (!id) return;
    setRoleEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)));
  };

  const handleSaveRoleEntry = async (entry: RoleEntry) => {
    try {
      setRolesLoading(true);
      setRolesMessage('');
      const res = await fetch('/api/admin/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, playerTag: entry.playerTag, role: entry.role }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to update role');
      }
      await loadRoleEntries();
      setRolesMessage('Permissions updated');
    } catch (error: any) {
      console.error('Failed to update role:', error);
      setRolesMessage(error?.message || 'Failed to update role');
    } finally {
      setRolesLoading(false);
    }
  };

  const handleDeleteRole = async (id?: string) => {
    if (!id) return;
    try {
      setRolesLoading(true);
      setRolesMessage('');
      const res = await fetch(`/api/admin/roles?id=${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to remove role');
      }
      await loadRoleEntries();
      setRolesMessage('Role removed');
    } catch (error: any) {
      console.error('Failed to remove role:', error);
      setRolesMessage(error?.message || 'Failed to remove role');
    } finally {
      setRolesLoading(false);
    }
  };

  const handleAddRole = async () => {
    if (!newRoleEmail.trim()) {
      setRolesMessage('Enter an email to grant access');
      return;
    }
    try {
      setRolesLoading(true);
      setRolesMessage('');
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newRoleEmail.trim(),
          playerTag: newRoleTag ? normalizeTag(newRoleTag) : undefined,
          role: newRoleRole,
          clanTag: effectiveClanTag,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to grant access');
      }
      setNewRoleEmail('');
      setNewRoleTag('');
      setNewRoleRole('member');
      await loadRoleEntries();
      setRolesMessage('Access granted successfully');
    } catch (error: any) {
      console.error('Failed to add role:', error);
      setRolesMessage(error?.message || 'Failed to grant access');
    } finally {
      setRolesLoading(false);
    }
  };

  const handleGenerateLinkCode = async () => {
    try {
      setIsGeneratingLink(true);
      const random = Math.random().toString(36).slice(2, 8).toUpperCase();
      const generated = `LDR-${random}`;
      setLinkCode(generated);
      setRolesMessage('New verification code generated. Add this to the clan description when promoting a leader.');
    } catch (error) {
      console.error('Failed to generate link code', error);
      setRolesMessage('Failed to generate link code');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const roleOptions: Array<{ value: ClanRoleName; label: string }> = [
    { value: 'leader', label: 'Leader' },
    { value: 'coleader', label: 'Co-Leader' },
    { value: 'elder', label: 'Elder' },
    { value: 'member', label: 'Member' },
    { value: 'viewer', label: 'Viewer' },
  ];

  const handleSwitchToClan = async () => {
    if (!newClanTag.trim()) {
      setMessage('Please enter a clan tag');
      return;
    }
    const normalized = normalizeTag(newClanTag);
    if (!isValidTag(normalized)) {
      setMessage('Please enter a valid clan tag (e.g., #2PR8R8V8P)');
      return;
    }
    setIsLoading(true);
    setMessage('');
    try {
      setClanTag(normalized);
      await loadRoster(normalized);
      setMessage('Clan switched successfully!');
    } catch (error) {
      console.error('Error switching clan:', error);
      setMessage('Failed to switch clan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadHomeClan = async () => {
    if (!homeClan) {
      setMessage('No home clan set');
      return;
    }
    setIsLoading(true);
    setMessage('');
    try {
      setClanTag(homeClan);
      await loadRoster(homeClan);
      setMessage('Home clan loaded successfully!');
    } catch (error) {
      console.error('Error loading home clan:', error);
      setMessage('Failed to load home clan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveUserRole = () => {
    setUserRole(newUserRole);
    setMessage('User role updated successfully!');
  };

  const handleForceRefresh = async () => {
    clearMessage();
    if (!clanTag) {
      setMessage('Load a clan first to enable force refresh');
      return;
    }
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/admin/force-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag, includeInsights: true }),
      });
      const result = await response.json();
      if (result.success) {
        clearSmartInsightsPayload(clanTag);
        setSmartInsights(null);
        setMessage(`Force refresh completed! ${result.data.memberCount} members, ${result.data.changesDetected} changes detected. Insights: ${result.data.insightsGenerated ? 'Generated' : 'Skipped'}`);
        showToast('Force refresh completed successfully!', 'success');
        await loadSmartInsights(clanTag, { force: true, ttlMs: 0 });
        await loadRoster(clanTag);
      } else {
        setMessage(`Force refresh failed: ${result.error}`);
        showToast('Force refresh failed', 'error');
      }
    } catch (error) {
      console.error('Force refresh error:', error);
      setMessage('Force refresh failed. Please try again.');
      showToast('Force refresh failed', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const clearMessage = () => setMessage('');

  const containerClass =
    layout === 'modal'
      ? 'space-y-6 max-h-[70vh] overflow-y-auto w-full'
      : 'settings-content mx-auto w-full max-w-5xl space-y-8';

  return (
    <div className={containerClass}>
      {layout === 'page' && (
        <GlassCard
          id="top"
          icon={<Settings className="h-5 w-5" aria-hidden />}
          title="Command Center Settings"
          subtitle="Configure clans, leadership access, refresh controls, and experimental features."
          className="space-y-2"
        >
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.36em] text-slate-300">
            <span className="rounded-full border border-brand-border/60 bg-brand-surfaceSubtle/60 px-3 py-1">Dashboard</span>
            <span className="rounded-full border border-brand-border/60 bg-brand-surfaceSubtle/60 px-3 py-1">Leadership</span>
            <span className="rounded-full border border-brand-border/60 bg-brand-surfaceSubtle/60 px-3 py-1">Maintenance</span>
          </div>
        </GlassCard>
      )}

      {message && (
        <GlassCard
          className={`text-sm ${
            message.includes('successfully')
              ? 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
              : 'border border-rose-400/40 bg-rose-500/10 text-rose-100'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{message}</span>
            <button onClick={clearMessage} className="text-xs text-slate-300 hover:text-slate-100">
              Dismiss
            </button>
          </div>
        </GlassCard>
      )}

      {permissions.canManageAccess && (
        <>
          <GlassCard
            id="permissions"
            icon={<Shield className="h-5 w-5" aria-hidden />}
            title="Clan Permissions"
            subtitle="Manage leadership access and invite new Supabase users."
            actions={
              <button
                onClick={handleGenerateLinkCode}
                disabled={isGeneratingLink}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingLink ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                    Generating…
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" aria-hidden />
                    Generate Link Code
                  </>
                )}
              </button>
            }
            className="space-y-4"
          >
            {rolesMessage && (
              <div
                className={`rounded-2xl border px-3 py-2 text-sm ${
                  rolesMessage.toLowerCase().includes('fail')
                    ? 'border-rose-400/40 bg-rose-500/15 text-rose-100'
                    : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                }`}
              >
                {rolesMessage}
              </div>
            )}

            {linkCode && (
              <div className="rounded-2xl border border-dashed border-blue-400/50 bg-brand-surfaceSubtle/80 px-4 py-3 text-xs text-blue-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-semibold text-blue-200">Verification Code:&nbsp;</span>
                    <span className="font-mono tracking-widest text-blue-100">{linkCode}</span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard?.writeText?.(linkCode)}
                    className="text-xs font-semibold text-blue-200 hover:text-blue-100"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-blue-200/80">
                  Place this code in the clan description for 15 minutes to verify a new leader or co-leader.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-100">Active access</h3>
              {rolesLoading && roleEntries.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                  Loading clan roles…
                </div>
              ) : roleEntries.length === 0 ? (
                <div className="rounded-2xl border border-brand-border/40 bg-brand-surfaceSubtle/60 px-4 py-3 text-sm text-slate-300">
                  No linked users yet. Invite a Supabase-authenticated email below to grant access.
                </div>
              ) : (
                roleEntries.map((entry) => (
                  <div
                    key={entry.id || `${entry.userId}-${entry.email}`}
                    className="rounded-2xl border border-brand-border/40 bg-brand-surfaceRaised/50 px-4 py-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{entry.email || 'Pending invitation'}</p>
                        <p className="text-xs font-mono text-slate-400">
                          {entry.playerTag ? entry.playerTag.toUpperCase() : 'No player tag linked'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteRole(entry.id)}
                        disabled={rolesLoading}
                        className="inline-flex items-center justify-center rounded-md border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove access
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col text-xs font-semibold text-slate-300">
                        Role
                        <select
                          value={entry.role}
                          onChange={(event) => updateRoleEntry(entry.id, { role: event.target.value as ClanRoleName })}
                          className="mt-1 rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col text-xs font-semibold text-slate-300">
                        Player tag (optional)
                        <input
                          type="text"
                          value={entry.playerTag}
                          onChange={(event) => updateRoleEntry(entry.id, { playerTag: event.target.value.toUpperCase() })}
                          placeholder="#2PR8R8V8P"
                          className="mt-1 rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => handleSaveRoleEntry(entry)}
                        disabled={rolesLoading || !entry.id}
                        className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {rolesLoading ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : 'Save changes'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-brand-border/40 bg-brand-surfaceSubtle/60 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-100">Invite new user</h3>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <label className="flex flex-col text-xs font-semibold text-slate-300">
                  Email address
                  <input
                    type="email"
                    value={newRoleEmail}
                    onChange={(event) => setNewRoleEmail(event.target.value)}
                    placeholder="leader@example.com"
                    className="mt-1 rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </label>
                <label className="flex flex-col text-xs font-semibold text-slate-300">
                  Role
                  <select
                    value={newRoleRole}
                    onChange={(event) => setNewRoleRole(event.target.value as ClanRoleName)}
                    className="mt-1 rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex flex-col text-xs font-semibold text-slate-300">
                Player tag (optional)
                <input
                  type="text"
                  value={newRoleTag}
                  onChange={(event) => setNewRoleTag(event.target.value)}
                  placeholder="#2PR8R8V8P"
                  className="mt-1 rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </label>
              <div className="flex justify-end">
                <button
                  onClick={handleAddRole}
                  disabled={rolesLoading}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rolesLoading ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : 'Invite and grant access'}
                </button>
              </div>
            </div>
          </GlassCard>

          <ElderAssessmentCard />
        </>
      )}

      <GlassCard
        id="home-clan"
        icon={<Home className="h-5 w-5" aria-hidden />}
        title="Home Clan"
        subtitle="Set the default clan loaded when the dashboard opens."
        className="space-y-4"
      >
        <label className="flex flex-col text-sm font-semibold text-slate-200">
          Default clan tag
          <input
            type="text"
            value={newHomeClan}
            onChange={(event) => setNewHomeClan(event.target.value)}
            placeholder="#2PR8R8V8P"
            className="mt-2 rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSaveHomeClan}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : 'Save home clan'}
          </button>
          <button
            onClick={handleLoadHomeClan}
            disabled={isLoading || !homeClan}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-400/60 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Load home clan
          </button>
          <span className="text-xs text-slate-400">Current: <span className="font-mono text-slate-200">{homeClan || 'Not set'}</span></span>
        </div>
      </GlassCard>

      <GlassCard
        id="clan-management"
        icon={<Users className="h-5 w-5" aria-hidden />}
        title="Switch to a different clan"
        subtitle="Load any clan on demand without changing the saved home clan."
        className="space-y-4"
      >
        <label className="flex flex-col text-sm font-semibold text-slate-200">
          Enter clan tag
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newClanTag}
              onChange={(event) => setNewClanTag(event.target.value)}
              placeholder="#2PR8R8V8P"
              className="flex-1 rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <button
              onClick={handleSwitchToClan}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-purple-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : 'Load clan'}
            </button>
          </div>
        </label>
        <p className="text-xs text-slate-400">Currently viewing: <span className="font-mono text-slate-200">{clanTag || 'None'}</span></p>
      </GlassCard>

      <GlassCard
        id="force-refresh"
        icon={<RefreshCw className="h-5 w-5" aria-hidden />}
        title="Force full refresh"
        subtitle="Rebuild data from scratch, including Smart Insights."
        className="space-y-3"
      >
        <p className="text-sm text-slate-200">
          Simulate the nightly cron: fetch the latest roster, persist a snapshot, detect membership changes, and regenerate Smart Insights.
        </p>
        <button
          onClick={handleForceRefresh}
          disabled={isRefreshing || !clanTag}
          className="inline-flex items-center gap-2 rounded-md bg-rose-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              Refreshing…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Force full refresh
            </>
          )}
        </button>
        {!clanTag && <p className="text-xs text-rose-200">Load a clan first to enable force refresh.</p>}
      </GlassCard>

      <GlassCard
        id="coming-soon"
        icon={<Settings className="h-5 w-5" aria-hidden />}
        title="Coming soon"
        subtitle="Planned controls for appearance, notifications, and data management."
        className="space-y-2"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-lg border border-brand-border/40 bg-brand-surfaceSubtle/60 px-3 py-2 text-sm text-slate-300">
            <Palette className="h-3.5 w-3.5 text-slate-200" aria-hidden />
            Appearance & themes
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-brand-border/40 bg-brand-surfaceSubtle/60 px-3 py-2 text-sm text-slate-300">
            <Bell className="h-3.5 w-3.5 text-slate-200" aria-hidden />
            Notifications
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-brand-border/40 bg-brand-surfaceSubtle/60 px-3 py-2 text-sm text-slate-300">
            <Database className="h-3.5 w-3.5 text-slate-200" aria-hidden />
            Data Management
          </div>
        </div>
      </GlassCard>

      <GlassCard
        id="role-impersonation"
        icon={<Settings className="h-5 w-5" aria-hidden />}
        title="Session role"
        subtitle="Preview the dashboard as another clan role without changing access."
        className="space-y-3"
      >
        <p className="text-sm text-slate-200">
          Adjust the impersonated role to match what leaders or members see. This only changes your current session.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={newUserRole}
            onChange={(event) => setNewUserRole(event.target.value as ClanRole)}
            className="rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleSaveUserRole}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-400"
          >
            Apply role view
          </button>
        </div>
      </GlassCard>

      {layout === 'modal' && onClose && (
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100">
            Close
          </button>
        </div>
      )}
    </div>
  );
}
