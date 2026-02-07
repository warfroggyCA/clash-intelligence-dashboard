"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { GlassCard } from '@/components/ui';
import { ElderAssessmentCard } from '@/components/settings/ElderAssessmentCard';
import PermissionManager from '@/components/settings/PermissionManager';
import AuditLog from '@/components/settings/AuditLog';
import { showToast } from '@/lib/toast';
import { useLeadership } from '@/hooks/useLeadership';
import { cfg } from '@/lib/config';
import type { ClanRoleName } from '@/lib/auth/roles';
import type { ClanRole } from '@/lib/leadership';
import { clearSmartInsightsPayload } from '@/lib/smart-insights-cache';
import {
  Settings,
  Shield,
  RefreshCw,
  Home,
  Users,
  Palette,
  Bell,
  Database,
  FileText,
  Plus,
  X,
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
  // Simple state - no Zustand (SSOT from API/localStorage)
  const [homeClan, setHomeClan] = useState<string>(cfg.homeClanTag);
  const [clanTag, setClanTag] = useState<string>(cfg.homeClanTag);
  const [userRole, setUserRole] = useState<ClanRoleName>('member');
  
  const [newHomeClan, setNewHomeClan] = useState(homeClan || '');
  const [newClanTag, setNewClanTag] = useState(clanTag || '');
  const [newUserRole, setNewUserRole] = useState(userRole);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isIngestingCapital, setIsIngestingCapital] = useState(false);
  const [message, setMessage] = useState('');

  const [roleEntries, setRoleEntries] = useState<RoleEntry[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesMessage, setRolesMessage] = useState('');
  const [newRoleEmail, setNewRoleEmail] = useState('');
  const [newRoleTag, setNewRoleTag] = useState('');
  const [newRoleRole, setNewRoleRole] = useState<ClanRoleName>('member');
  const [newRolePassword, setNewRolePassword] = useState('');

  const { permissions } = useLeadership();
  const effectiveClanTag = normalizeTag(clanTag || newClanTag || homeClan || newHomeClan || cfg.homeClanTag || '');

  const generatePassword = useCallback(() => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    const length = 14;
    let result = '';
    for (let i = 0; i < length; i += 1) {
      const idx = Math.floor(Math.random() * alphabet.length);
      result += alphabet[idx];
    }
    setNewRolePassword(result);
    return result;
  }, []);
  
  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clan-settings');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.homeClan) setHomeClan(data.homeClan);
        if (data.clanTag) setClanTag(data.clanTag);
        if (data.userRole) setUserRole(data.userRole);
        setNewHomeClan(data.homeClan || '');
        setNewClanTag(data.clanTag || '');
        setNewUserRole(data.userRole || 'member');
      }
    } catch (error) {
      console.warn('[Settings] Failed to load from localStorage:', error);
    }
  }, []);

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
      // Save to localStorage (SSOT)
      localStorage.setItem('clan-settings', JSON.stringify({ 
        homeClan: normalized, 
        clanTag, 
        userRole 
      }));
      setMessage('Home clan updated successfully!');
      // No need to load roster here - components fetch directly from API
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
      
      // Handle non-JSON responses (e.g., plain text "Unauthorized")
      let body;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        body = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server error: ${res.status} ${res.statusText}`);
      }
      
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
      
      // Handle non-JSON responses (e.g., plain text "Unauthorized")
      let body;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        body = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server error: ${res.status} ${res.statusText}`);
      }
      
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
      
      // Handle non-JSON responses (e.g., plain text "Unauthorized")
      let body;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        body = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server error: ${res.status} ${res.statusText}`);
      }
      
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
      const initialPassword = newRolePassword.trim() || undefined;
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newRoleEmail.trim(),
          playerTag: newRoleTag ? normalizeTag(newRoleTag) : undefined,
          role: newRoleRole,
          clanTag: effectiveClanTag,
          password: initialPassword,
        }),
      });
      
      // Handle non-JSON responses (e.g., plain text "Unauthorized")
      let body;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        body = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server error: ${res.status} ${res.statusText}`);
      }
      
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to grant access');
      }
      setNewRoleEmail('');
      setNewRoleTag('');
      setNewRoleRole('member');
      setNewRolePassword('');
      await loadRoleEntries();
      setRolesMessage(initialPassword ? 'Account created and access granted' : 'Access granted successfully');
    } catch (error: any) {
      console.error('Failed to add role:', error);
      setRolesMessage(error?.message || 'Failed to grant access');
    } finally {
      setRolesLoading(false);
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
      // Save to localStorage (SSOT)
      localStorage.setItem('clan-settings', JSON.stringify({ 
        homeClan, 
        clanTag: normalized, 
        userRole 
      }));
      setMessage('Clan switched successfully! Refresh page to see new clan.');
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
      // Save to localStorage (SSOT)
      localStorage.setItem('clan-settings', JSON.stringify({ 
        homeClan, 
        clanTag: homeClan, 
        userRole 
      }));
      setMessage('Loaded home clan! Refresh page to see changes.');
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
    const targetClanTag = effectiveClanTag;
    if (!targetClanTag || !isValidTag(targetClanTag)) {
      setMessage('Set or select a clan tag before forcing refresh.');
      return;
    }
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/admin/force-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag: targetClanTag, includeInsights: true }),
      });
      const result = await response.json();
      if (result.success) {
        clearSmartInsightsPayload(targetClanTag);
        setMessage(`Force refresh completed! ${result.data.memberCount} members, ${result.data.changesDetected} changes detected. Insights: ${result.data.insightsGenerated ? 'Generated' : 'Skipped'}. Refresh page to see updates.`);
        showToast('Force refresh completed successfully! Refresh page to see updates.', 'success');
        // No need to call store methods - components fetch directly from API
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

  const handleCapitalIngestion = async () => {
    clearMessage();
    const targetClanTag = effectiveClanTag;
    if (!targetClanTag || !isValidTag(targetClanTag)) {
      setMessage('Set or select a clan tag before ingesting capital data.');
      return;
    }
    setIsIngestingCapital(true);
    try {
      const response = await fetch('/api/admin/capital-ingestion', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag: targetClanTag, seasonLimit: 20 }), // Increased to get more weekends
      });
      const result = await response.json();
      if (result.success) {
        setMessage(`Capital ingestion completed! ${result.seasons_ingested} seasons, ${result.weekends_ingested} weekends, ${result.participants_ingested} participants ingested.`);
        showToast('Capital raid data ingested successfully!', 'success');
      } else {
        setMessage(`Capital ingestion failed: ${result.error || 'Unknown error'}`);
        showToast('Capital ingestion failed', 'error');
      }
    } catch (error: any) {
      console.error('Capital ingestion error:', error);
      setMessage(`Capital ingestion failed: ${error?.message || 'Please try again.'}`);
      showToast('Capital ingestion failed', 'error');
    } finally {
      setIsIngestingCapital(false);
    }
  };

  const clearMessage = () => setMessage('');

  const containerClass =
    layout === 'modal'
      ? 'space-y-6 max-h-[70vh] overflow-y-auto w-full'
      : 'settings-content w-full space-y-8';

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
            subtitle="Manage leadership access and invite new users."
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

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-100">Active access</h3>
              {rolesLoading && roleEntries.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                  Loading clan roles…
                </div>
              ) : roleEntries.length === 0 ? (
                <div className="rounded-2xl border border-brand-border/40 bg-brand-surfaceSubtle/60 px-4 py-3 text-sm text-slate-300">
                  No linked users yet. Invite an approved email below to grant access.
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
              <label className="flex flex-col text-xs font-semibold text-slate-300">
                Initial password (optional)
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={newRolePassword}
                    onChange={(event) => setNewRolePassword(event.target.value)}
                    placeholder="Generate or enter a password"
                    className="flex-1 rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="rounded-md border border-slate-500 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-slate-800"
                  >
                    Generate
                  </button>
                </div>
                <span className="mt-1 text-[11px] font-normal text-slate-400">
                  Required for new accounts. Leave blank to link an existing user.
                </span>
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

          {/* Permission Manager - Only Leaders can customize permissions */}
          {permissions.canManageAccess && (
            <GlassCard
              id="permission-manager"
              icon={<Shield className="h-5 w-5" aria-hidden />}
              title="Permission Manager"
              subtitle="Configure custom permissions for each access level."
              className="space-y-4"
            >
              <PermissionManager clanTag={clanTag || cfg.homeClanTag} />
            </GlassCard>
          )}
        </>
      )}

      {/* Audit Log - Can be granted to any role via Permission Manager */}
      {permissions.canViewAuditLog && (
        <GlassCard
          id="audit-log"
          icon={<FileText className="h-5 w-5" aria-hidden />}
          title="Audit Log"
          subtitle="View all changes made by leadership. Permission can be granted to other roles via Permission Manager."
          className="space-y-4"
        >
          <AuditLog clanTag={clanTag || cfg.homeClanTag} />
        </GlassCard>
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
        id="tracked-clans"
        icon={<Database className="h-5 w-5" aria-hidden />}
        title="Multi-Clan Tracking"
        subtitle="Manage clans tracked by Mac ingestion cron jobs. All tracked clans will be ingested daily."
        className="space-y-4"
      >
        <TrackedClansManager homeClan={homeClan || cfg.homeClanTag} />
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
        id="capital-ingestion"
        icon={<Home className="h-5 w-5" aria-hidden />}
        title="Capital Raid Ingestion"
        subtitle="Fetch and store capital raid data from Clash of Clans API."
        className="space-y-3"
      >
        <p className="text-sm text-slate-200">
          Manually trigger capital raid data ingestion. Fetches the last 10 raid weekends and updates existing records or inserts new ones.
        </p>
        <button
          onClick={handleCapitalIngestion}
          disabled={isIngestingCapital || !clanTag}
          className="inline-flex items-center gap-2 rounded-md bg-purple-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isIngestingCapital ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              Ingesting…
            </>
          ) : (
            <>
              <Home className="h-4 w-4" aria-hidden />
              Ingest Capital Raid Data
            </>
          )}
        </button>
        {!clanTag && <p className="text-xs text-purple-200">Load a clan first to enable capital ingestion.</p>}
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

      {permissions.canManageAccess && (
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
              onChange={(event) => setNewUserRole(event.target.value as ClanRoleName)}
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
      )}

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

// Tracked Clans Manager Component
function TrackedClansManager({ homeClan }: { homeClan?: string | null }) {
  const [trackedClans, setTrackedClans] = useState<string[]>([]);
  const [newClanTag, setNewClanTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const normalizedHomeClan = normalizeTag(homeClan || cfg.homeClanTag || '');
  const hasHomeClanConfigured = Boolean(normalizedHomeClan);

  const fetchTrackedClans = useCallback(async () => {
    try {
      setFetching(true);
      const response = await fetch('/api/tracked-clans', {
        credentials: 'same-origin',
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const clans = (result.data.clans || []) as string[];
          if (normalizedHomeClan) {
            setTrackedClans(clans.filter((tag) => normalizeTag(tag) !== normalizedHomeClan));
          } else {
            setTrackedClans(clans);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch tracked clans:', error);
    } finally {
      setFetching(false);
    }
  }, [normalizedHomeClan]);

  useEffect(() => {
    void fetchTrackedClans();
  }, [fetchTrackedClans]);

  const handleAddClan = async () => {
    if (!newClanTag.trim()) {
      showToast('Please enter a clan tag', 'error');
      return;
    }

    const normalizedTag = normalizeTag(newClanTag);
    if (!isValidTag(normalizedTag)) {
      showToast('Invalid clan tag format', 'error');
      return;
    }

    if (normalizedHomeClan && normalizedTag === normalizedHomeClan) {
      showToast('Home clan is ingested automatically. Track other clans only.', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/tracked-clans', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clanTag: normalizedTag }),
      });

      const result = await response.json();
      
      if (result.success) {
        setTrackedClans(result.data.clans);
        setNewClanTag('');
        showToast(`Added ${normalizedTag} to tracked clans`, 'success');
      } else {
        showToast(result.error || 'Failed to add clan', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to add clan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveClan = async (clanTag: string) => {
    if (normalizedHomeClan && normalizeTag(clanTag) === normalizedHomeClan) {
      showToast('Home clan tracking cannot be managed here.', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/tracked-clans?clanTag=${encodeURIComponent(clanTag)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });

      const result = await response.json();
      
      if (result.success) {
        setTrackedClans(result.data.clans);
        showToast(`Removed ${clanTag} from tracked clans`, 'success');
      } else {
        showToast(result.error || 'Failed to remove clan', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to remove clan', 'error');
    } finally {
      setLoading(false);
    }
  };


  if (fetching) {
    return <div className="text-sm text-slate-400">Loading tracked clans...</div>;
  }

  return (
    <div className="space-y-4">
      {!hasHomeClanConfigured && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Set a home clan above before tracking additional clans. The home clan is ingested automatically.
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={newClanTag}
          onChange={(e) => setNewClanTag(e.target.value)}
          placeholder="#2PR8R8V8P"
          className="flex-1 rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !loading) {
              void handleAddClan();
            }
          }}
          disabled={!hasHomeClanConfigured}
        />
        <button
          onClick={handleAddClan}
          disabled={loading || !newClanTag.trim() || !hasHomeClanConfigured}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          Add Clan
        </button>
      </div>

      {trackedClans.length === 0 ? (
        <p className="text-sm text-slate-400">No clans are currently being tracked. Add a clan tag above to start tracking.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Tracked Clans ({trackedClans.length})</p>
          <p className="text-xs text-slate-400">
            Home clan {normalizedHomeClan || '—'} is automatically ingested and does not appear here.
          </p>
          <div className="space-y-2">
            {trackedClans.map((tag) => (
              <div
                key={tag}
                className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2"
              >
                <span className="font-mono text-sm text-slate-200">{tag}</span>
                <button
                  onClick={() => void handleRemoveClan(tag)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-700/50 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Remove from tracking"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Mac cron jobs will ingest all tracked clans daily at 4:30 AM and 5:30 AM UTC.
          </p>
        </div>
      )}
    </div>
  );
}
