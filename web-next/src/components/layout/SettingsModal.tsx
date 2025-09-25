"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { Settings, Home, Users, Palette, Bell, Shield, Database, RefreshCw, Key } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { useLeadership } from '@/hooks/useLeadership';
import type { ClanRoleName } from '@/lib/auth/roles';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    homeClan,
    clanTag,
    setHomeClan,
    setClanTag,
    loadRoster,
    userRole,
    setUserRole,
  } = useDashboardStore();

  const [newHomeClan, setNewHomeClan] = useState(homeClan || '');
  const [newClanTag, setNewClanTag] = useState(clanTag || '');
  const [newUserRole, setNewUserRole] = useState(userRole);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  interface RoleEntry {
    id?: string;
    userId: string;
    email: string | null;
    playerTag: string;
    role: ClanRoleName;
  }
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

  // Update local state when props change
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

    const normalizedTag = normalizeTag(newHomeClan);
    if (!isValidTag(normalizedTag)) {
      setMessage('Please enter a valid clan tag (e.g., #2PR8R8V8P)');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      setHomeClan(normalizedTag);
      setMessage('Home clan updated successfully!');
      
      // Auto-load the new home clan if no current clan is loaded
      if (!clanTag) {
        await loadRoster(normalizedTag);
      }
    } catch (error) {
      setMessage('Failed to update home clan');
      console.error('Error updating home clan:', error);
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
    if (isOpen && permissions.canManageAccess) {
      void loadRoleEntries();
    }
  }, [isOpen, permissions.canManageAccess, loadRoleEntries]);

  const updateRoleEntry = (id: string | undefined, updates: Partial<RoleEntry>) => {
    if (!id) return;
    setRoleEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry))
    );
  };

  const handleSaveRoleEntry = async (entry: RoleEntry) => {
    try {
      setRolesLoading(true);
      setRolesMessage('');
      const res = await fetch('/api/admin/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          playerTag: entry.playerTag,
          role: entry.role,
        }),
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
      // TODO: Replace with API-backed minting. For now generate a deterministic-looking code.
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

    const normalizedTag = normalizeTag(newClanTag);
    if (!isValidTag(normalizedTag)) {
      setMessage('Please enter a valid clan tag (e.g., #2PR8R8V8P)');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      setClanTag(normalizedTag);
      await loadRoster(normalizedTag);
      setMessage('Clan switched successfully!');
    } catch (error) {
      setMessage('Failed to switch clan');
      console.error('Error switching clan:', error);
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
      setMessage('Failed to load home clan');
      console.error('Error loading home clan:', error);
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
      setMessage('No clan loaded. Please load a clan first.');
      return;
    }

    setIsRefreshing(true);
    try {
      const response = await fetch('/api/admin/force-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag: clanTag,
          includeInsights: true
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage(`Force refresh completed! ${result.data.memberCount} members, ${result.data.changesDetected} changes detected. Insights: ${result.data.insightsGenerated ? 'Generated' : 'Skipped'}`);
        showToast('Force refresh completed successfully!', 'success');
        
        // Refresh the current roster to show new data
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

  const clearMessage = () => {
    setMessage('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      size="xl"
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto w-full max-w-full">
        {/* Message Display */}
        {message && (
          <div className={`p-3 rounded-lg ${
            message.includes('successfully') 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{message}</span>
              <button
                onClick={clearMessage}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {permissions.canManageAccess && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-semibold text-gray-900">Clan Permissions</h3>
              </div>
              <button
                onClick={handleGenerateLinkCode}
                disabled={isGeneratingLink}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingLink ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    <span>Generate Link Code</span>
                  </>
                )}
              </button>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 space-y-4">
              {rolesMessage && (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    rolesMessage.toLowerCase().includes('fail')
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-green-200 bg-green-50 text-green-700'
                  }`}
                >
                  {rolesMessage}
                </div>
              )}

              {linkCode && (
                <div className="rounded-md border border-dashed border-blue-300 bg-white px-4 py-3 text-sm text-blue-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold">Verification Code:&nbsp;</span>
                      <span className="font-mono tracking-widest">{linkCode}</span>
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText?.(linkCode)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-blue-600">
                    Place this code in the clan description for 15 minutes to verify a new leader or co-leader.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">Active Access</h4>
                {rolesLoading && roleEntries.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Loading clan roles…</span>
                  </div>
                ) : roleEntries.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    No linked users yet. Invite a Supabase-authenticated email below to grant access.
                  </div>
                ) : (
                  roleEntries.map((entry) => (
                    <div
                      key={entry.id || `${entry.userId}-${entry.email}`}
                      className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {entry.email || 'Pending invitation'}
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            {entry.playerTag ? entry.playerTag.toUpperCase() : 'No player tag linked'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteRole(entry.id)}
                          disabled={rolesLoading}
                          className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove access
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col text-xs font-medium text-slate-600">
                          Role
                          <select
                            value={entry.role}
                            onChange={(event) => updateRoleEntry(entry.id, { role: event.target.value as ClanRoleName })}
                            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          >
                            {roleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col text-xs font-medium text-slate-600">
                          Player tag (optional)
                          <input
                            type="text"
                            value={entry.playerTag}
                            onChange={(event) => updateRoleEntry(entry.id, { playerTag: event.target.value.toUpperCase() })}
                            placeholder="#2PR8R8V8P"
                            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </label>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => handleSaveRoleEntry(entry)}
                          disabled={rolesLoading || !entry.id}
                          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {rolesLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Save changes'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-blue-100 pt-4">
                <h4 className="text-sm font-semibold text-slate-900">Grant new access</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.7fr),minmax(0,1fr),auto]">
                  <input
                    type="email"
                    value={newRoleEmail}
                    onChange={(event) => setNewRoleEmail(event.target.value)}
                    placeholder="leader@example.com"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
                    <input
                      type="text"
                      value={newRoleTag}
                      onChange={(event) => setNewRoleTag(event.target.value.toUpperCase())}
                      placeholder="#PlayerTag"
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <select
                      value={newRoleRole}
                      onChange={(event) => setNewRoleRole(event.target.value as ClanRoleName)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleAddRole}
                    disabled={rolesLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {rolesLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Grant access'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-blue-700">
                  Email must match an existing Supabase-authenticated user. Link player tags so promotions auto-sync with roster ingest.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Default Clan */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Home className="w-4 h-4 text-blue-600" />
            <h3 className="text-base font-semibold text-gray-900">Default Clan</h3>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Set your default clan (loads automatically on refresh)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newHomeClan}
                  onChange={(e) => setNewHomeClan(e.target.value)}
                  placeholder="#2PR8R8V8P"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
                />
                <button
                  onClick={handleSaveHomeClan}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Current default: <span className="font-mono">{homeClan || 'None set'}</span>
              </p>
            </div>

            {homeClan && (
              <div>
                <button
                  onClick={handleLoadHomeClan}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Load Default Clan Now
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Switch to Different Clan */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-purple-600" />
            <h3 className="text-base font-semibold text-gray-900">Switch to Different Clan</h3>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter any clan tag to view their data
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newClanTag}
                  onChange={(e) => setNewClanTag(e.target.value)}
                  placeholder="#2PR8R8V8P"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-0"
                />
                <button
                  onClick={handleSwitchToClan}
                  disabled={isLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Load Clan'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Currently viewing: <span className="font-mono">{clanTag || 'None'}</span>
              </p>
            </div>
          </div>
        </div>

                {/* Force Full Refresh */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 text-red-600" />
                    <h3 className="text-base font-semibold text-gray-900">Force Full Refresh</h3>
                  </div>
                  
                  <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-3">
                      Simulate the overnight cron job to rebuild all data from scratch. This will:
                    </p>
                    <ul className="text-xs text-gray-600 space-y-1 mb-4">
                      <li>• Fetch fresh clan data from Clash of Clans API</li>
                      <li>• Create new snapshot in database</li>
                      <li>• Detect changes and generate insights summaries</li>
                      <li>• Fix 404 errors and greyed-out buttons</li>
                    </ul>
                    <button
                      onClick={handleForceRefresh}
                      disabled={isRefreshing || !clanTag}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      {isRefreshing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Refreshing...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Force Full Refresh</span>
                        </>
                      )}
                    </button>
                    {!clanTag && (
                      <p className="text-xs text-red-600 mt-2">
                        Load a clan first to enable force refresh
                      </p>
                    )}
                  </div>
                </div>

                {/* Future Settings Placeholders - Compact */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Coming Soon</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Palette className="w-3 h-3" />
                      <span>Appearance & Themes</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Bell className="w-3 h-3" />
                      <span>Notifications</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Database className="w-3 h-3" />
                      <span>Data Management</span>
                    </div>
                  </div>
                </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
