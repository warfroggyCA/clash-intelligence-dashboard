/**
 * PlayerProfileModal Component
 * 
 * A comprehensive modal for displaying detailed player information.
 * Handles player data display, notes, and interaction features.
 * 
 * Features:
 * - Detailed player statistics
 * - Hero level display
 * - Player notes management
 * - Custom fields
 * - Responsive design
 * - Accessibility features
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Member, Roster } from '@/types';
import { Modal } from '@/components/ui';
import { Button, SuccessButton, DangerButton } from '@/components/ui';
import LeadershipGuard from '@/components/LeadershipGuard';
import {
  calculateRushPercentage,
  calculateDonationBalance,
  getTownHallLevel,
  isRushed,
  isVeryRushed,
  isNetReceiver,
  isLowDonator,
} from '@/lib/business/calculations';
import { HERO_MAX_LEVELS, HeroCaps } from '@/types';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { showToast } from '@/lib/toast';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { resolveMemberActivity } from '@/lib/activity/resolve-member-activity';

// =============================================================================
// TYPES
// =============================================================================

export interface PlayerProfileModalProps {
  member: Member;
  clanTag: string;
  roster: Roster | null;
  onClose: () => void;
}

interface PlayerNote {
  timestamp: string;
  note: string;
  addedBy?: string;
}

const HERO_KEY_ORDER: Array<keyof HeroCaps> = ['bk', 'aq', 'gw', 'rc', 'mp'];
const HERO_LABELS: Record<keyof HeroCaps, string> = {
  bk: 'Barbarian King',
  aq: 'Archer Queen',
  gw: 'Grand Warden',
  rc: 'Royal Champion',
  mp: 'Minion Prince',
};
const HERO_SHORT_LABELS: Record<keyof HeroCaps, string> = {
  bk: 'BK',
  aq: 'AQ',
  gw: 'GW',
  rc: 'RC',
  mp: 'MP',
};

interface ModalHeroBreakdownRow {
  hero: keyof HeroCaps;
  label: string;
  shortLabel: string;
  current: number;
  cap: number;
  deficit: number;
  deficitPct: number;
}

const getRushBadgeClass = (value: number): string => {
  if (value >= 70) return 'bg-red-100 text-red-800';
  if (value >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
};

// =============================================================================
// COMPONENT
// =============================================================================

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  member,
  clanTag,
  roster,
  onClose
}) => {
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const store = useDashboardStore();
  const loadRoster = store.loadRoster;
  const clanTagForActions = roster?.clanTag || store.clanTag || store.homeClan || cfg.homeClanTag || '';
  const normalizedMemberTag = normalizeTag(member.tag);
  const [tenureDays, setTenureDays] = useState<number>(() => Number(member.tenure_days ?? member.tenure ?? 0) || 0);
  const [tenureInput, setTenureInput] = useState<string>(() => String(Number(member.tenure_days ?? member.tenure ?? 0) || 0));
  const [isSavingTenure, setIsSavingTenure] = useState(false);

  // Calculate player metrics
  const th = getTownHallLevel(member);
  const rushPercent = calculateRushPercentage(member);
  const donationBalance = calculateDonationBalance(member);
  const activity = resolveMemberActivity(member);
  const isRushedPlayer = isRushed(member);
  const isVeryRushedPlayer = isVeryRushed(member);
  const isNetReceiverPlayer = isNetReceiver(member);
  const isLowDonatorPlayer = isLowDonator(member);

  const heroBreakdown = useMemo<ModalHeroBreakdownRow[]>(() => {
    const caps = HERO_MAX_LEVELS[th] || {};
    return HERO_KEY_ORDER
      .map((hero) => {
        const cap = caps?.[hero] ?? 0;
        if (!cap) return null;
        const current = member[hero] ?? 0;
        const deficit = Math.max(0, cap - current);
        const deficitPct = cap > 0 ? (deficit / cap) * 100 : 0;
        return {
          hero,
          label: HERO_LABELS[hero],
          shortLabel: HERO_SHORT_LABELS[hero],
          current,
          cap,
          deficit,
          deficitPct,
        };
      })
      .filter((row): row is ModalHeroBreakdownRow => row !== null);
  }, [member, th]);

  const heroShortList = heroBreakdown.map((row) => row.shortLabel).join(', ');
  const heroRushDisplay = Number.isFinite(rushPercent)
    ? rushPercent.toFixed(1)
    : '0.0';

  // Load player notes and custom fields
  useEffect(() => {
    const loadPlayerData = () => {
      try {
        const notesKey = `player_notes_${member.tag.toUpperCase()}`;
        const fieldsKey = `player_fields_${member.tag.toUpperCase()}`;
        
        const savedNotes = localStorage.getItem(notesKey);
        const savedFields = localStorage.getItem(fieldsKey);
        
        if (savedNotes) {
          setNotes(JSON.parse(savedNotes));
        }
        
        if (savedFields) {
          setCustomFields(JSON.parse(savedFields));
        }
      } catch (error) {
        console.error('Failed to load player data:', error);
      }
    };

    loadPlayerData();
  }, [member.tag]);

  useEffect(() => {
    const days = Number(member.tenure_days ?? member.tenure ?? 0) || 0;
    setTenureDays(days);
    setTenureInput(String(days));
  }, [member.tag, member.tenure_days, member.tenure]);

  const updateLocalTenure = (days: number, asOf?: string) => {
    if (typeof store.updateRosterMemberTenure === 'function') {
      store.updateRosterMemberTenure(member.tag, days, asOf);
    } else {
      useDashboardStore.setState((state) => {
        if (!state.roster) return {};
        const members = state.roster.members.map((m) =>
          normalizeTag(m.tag) === normalizedMemberTag
            ? { ...m, tenure_days: days, tenure_as_of: asOf ?? m.tenure_as_of }
            : m
        );
        return { roster: { ...state.roster, members } } as Partial<typeof state>;
      });
    }
  };

  const reloadRoster = async () => {
    if (!clanTagForActions) return;
    try {
      await loadRoster(clanTagForActions, { mode: 'live', force: true });
    } catch (error) {
      console.warn('[PlayerProfileModal] Failed to reload roster after tenure update', error);
    }
  };

  const handleTenureSave = async () => {
    const trimmed = tenureInput.trim();
    if (!trimmed) {
      showToast('Enter tenure in days', 'error');
      return;
    }
    const match = trimmed.match(/\d+/);
    if (!match) {
      showToast('Tenure must be a number of days', 'error');
      return;
    }
    const days = Math.max(0, Math.min(20000, Number.parseInt(match[0], 10)));
    try {
      setIsSavingTenure(true);
      const res = await fetch('/api/tenure/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [
            {
              tag: member.tag,
              tenure_days: days,
              clanTag: clanTagForActions,
              player_name: member.name,
            },
          ],
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message = payload?.error || payload?.message || 'Failed to update tenure';
        throw new Error(message);
      }
      const result = payload?.data?.updates?.[0];
      const tenureDays = typeof result?.tenureDays === 'number' ? result.tenureDays : days;
      const asOf = result?.asOf ?? new Date().toISOString().slice(0, 10);
      setTenureDays(tenureDays);
      setTenureInput(String(tenureDays));
      updateLocalTenure(tenureDays, asOf);
      showToast(`Tenure updated to ${days} day${days === 1 ? '' : 's'}`, 'success');
      await reloadRoster();
    } catch (error: any) {
      const message = error?.message || 'Failed to update tenure';
      showToast(message, 'error');
    } finally {
      setIsSavingTenure(false);
    }
  };

  const handleGrantPriorTenure = async () => {
    if (!clanTagForActions) {
      showToast('Load a clan before granting tenure', 'error');
      return;
    }
    try {
      setIsSavingTenure(true);
      const res = await fetch('/api/tenure/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag: clanTagForActions, memberTag: member.tag, mode: 'grant-existing' })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message = payload?.error || payload?.message || 'Failed to grant prior tenure';
        throw new Error(message);
      }
      const grantedTenure = typeof payload?.data?.tenureDays === 'number' ? payload.data.tenureDays : tenureDays;
      const asOf = payload?.data?.asOf ?? new Date().toISOString().slice(0, 10);
      setTenureDays(grantedTenure);
      setTenureInput(String(grantedTenure));
      updateLocalTenure(grantedTenure, asOf);
      showToast('Granted prior tenure', 'success');
      await reloadRoster();
    } catch (error: any) {
      const message = error?.message || 'Failed to grant prior tenure';
      showToast(message, 'error');
    } finally {
      setIsSavingTenure(false);
    }
  };

  const handleResetTenure = async () => {
    if (!clanTagForActions) {
      showToast('Load a clan before resetting tenure', 'error');
      return;
    }
    try {
      setIsSavingTenure(true);
      const res = await fetch('/api/tenure/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag: clanTagForActions, memberTag: member.tag, mode: 'reset' })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message = payload?.error || payload?.message || 'Failed to reset tenure';
        throw new Error(message);
      }
      setTenureDays(0);
      setTenureInput('0');
      updateLocalTenure(0, payload?.data?.asOf ?? new Date().toISOString().slice(0, 10));
      showToast('Tenure reset to 0', 'success');
      await reloadRoster();
    } catch (error: any) {
      const message = error?.message || 'Failed to reset tenure';
      showToast(message, 'error');
    } finally {
      setIsSavingTenure(false);
    }
  };

  const handleSaveNote = () => {
    if (!newNote.trim()) return;

    const note: PlayerNote = {
      timestamp: new Date().toISOString(),
      note: newNote.trim(),
      addedBy: 'Current User' // Would be replaced with actual user
    };

    const updatedNotes = [...notes, note];
    setNotes(updatedNotes);
    setNewNote('');
    setIsEditing(false);

    // Save to localStorage
    try {
      const notesKey = `player_notes_${member.tag.toUpperCase()}`;
      localStorage.setItem(notesKey, JSON.stringify(updatedNotes));
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const handleSaveCustomFields = () => {
    try {
      const fieldsKey = `player_fields_${member.tag.toUpperCase()}`;
      localStorage.setItem(fieldsKey, JSON.stringify(customFields));
    } catch (error) {
      console.error('Failed to save custom fields:', error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown Date';
    try {
      // Check if the date string contains invalid characters
      if (typeof dateString !== 'string' || dateString.includes('U') || dateString.includes('u')) {
        console.error('Invalid date string contains U character:', dateString);
        return 'Invalid Date';
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.error('Invalid date object created from:', dateString);
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'Input:', dateString);
      return 'Invalid Date';
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`${member.name} (${member.tag})`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Player Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Town Hall:</span>
                  <span className="font-semibold">TH{th}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Trophies:</span>
                  <span className="font-semibold">{member.trophies?.toLocaleString() || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Role:</span>
                  <span className="font-semibold capitalize">{member.role || 'Member'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tenure:</span>
                  <span className="font-semibold">
                    {member.tenure_days || member.tenure || 0} days
                  </span>
                </div>
              </div>
            </div>

            {/* Hero Levels */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Hero Levels</h3>
              <div className="space-y-2">
                {member.bk && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Barbarian King:</span>
                    <span className="font-semibold">{member.bk}</span>
                  </div>
                )}
                {member.aq && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Archer Queen:</span>
                    <span className="font-semibold">{member.aq}</span>
                  </div>
                )}
                {member.gw && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Grand Warden:</span>
                    <span className="font-semibold">{member.gw}</span>
                  </div>
                )}
                {member.rc && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Royal Champion:</span>
                    <span className="font-semibold">{member.rc}</span>
                  </div>
                )}
                {member.mp && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Master Builder:</span>
                    <span className="font-semibold">{member.mp}</span>
                  </div>
                )}
              </div>
          </div>
        </div>

        <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
          <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-4 text-sm text-emerald-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-emerald-100">Tenure Controls</h4>
                <p className="text-xs text-emerald-200/80">Adjust stored tenure. Changes update the ledger immediately.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,auto]">
              <label className="flex flex-col text-xs font-semibold text-emerald-100">
                Tenure (days)
                <input
                  type="number"
                  min={0}
                  max={20000}
                  value={tenureInput}
                  onChange={(event) => setTenureInput(event.target.value)}
                  className="mt-1 rounded-md border border-emerald-400/60 bg-slate-950/70 px-3 py-2 text-sm text-emerald-50 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </label>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" onClick={handleResetTenure} disabled={isSavingTenure}>
                  Reset to 0
                </Button>
                <Button variant="ghost" onClick={handleGrantPriorTenure} disabled={isSavingTenure || !clanTagForActions}>
                  Grant prior tenure
                </Button>
                <SuccessButton onClick={handleTenureSave} disabled={isSavingTenure}>
                  {isSavingTenure ? 'Saving…' : 'Save tenure'}
                </SuccessButton>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-emerald-200/80">
              <span>Current stored: {tenureDays} day{tenureDays === 1 ? '' : 's'}</span>
              {member.tenure_as_of && <span>Last set: {member.tenure_as_of}</span>}
              {!clanTagForActions && <span className="text-emerald-300/60">Load a clan to sync roster after saving.</span>}
            </div>
          </div>
        </LeadershipGuard>

        {/* Player Status Indicators */}
        <div className="mt-4 flex flex-wrap gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRushBadgeClass(rushPercent)}`}>
              Hero Rush: {heroRushDisplay}%
            </span>
            {isRushedPlayer && (
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                isVeryRushedPlayer
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {isVeryRushedPlayer ? 'Very Rushed' : 'Rushed'}
              </span>
            )}
            {isNetReceiverPlayer && (
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                Net Receiver
              </span>
            )}
            {isLowDonatorPlayer && (
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                Low Donator
              </span>
            )}
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              activity.level === 'Very Active' ? 'bg-green-100 text-green-800' :
              activity.level === 'Active' ? 'bg-blue-100 text-blue-800' :
              activity.level === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
              activity.level === 'Low' ? 'bg-orange-100 text-orange-800' :
              'bg-red-100 text-red-800'
            }`}>
              {activity.level}
            </span>
          </div>
        </div>

        {/* Rush Analysis */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Hero Rush Breakdown</h3>
          <div>
            <div className="text-sm text-gray-500">Hero Rush %</div>
            <div className={`text-2xl font-bold ${rushPercent >= 70 ? 'text-red-600' : rushPercent >= 40 ? 'text-orange-500' : 'text-white'}`}>
              {heroRushDisplay}%
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Average shortfall across unlocked heroes ({heroShortList || 'none yet'}). Lower is better.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-gray-600">Hero</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-gray-600">Level / Cap</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-gray-600">Levels Behind</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-gray-600">Gap %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {heroBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-gray-500">
                      No hero data available for this player yet.
                    </td>
                  </tr>
                ) : (
                  heroBreakdown.map((row) => (
                    <tr key={row.hero}>
                      <td className="px-3 py-2 font-medium text-gray-700">{row.label}</td>
                      <td className="px-3 py-2 text-gray-600">{row.current}/{row.cap}</td>
                      <td className="px-3 py-2 text-gray-600">{row.deficit}</td>
                      <td className="px-3 py-2 text-gray-600">{row.deficitPct.toFixed(1)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Donation Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Donation Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {member.donations?.toLocaleString() || 0}
              </div>
              <div className="text-sm text-gray-600">Given</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {member.donationsReceived?.toLocaleString() || 0}
              </div>
              <div className="text-sm text-gray-600">Received</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                donationBalance.balance > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {donationBalance.balance > 0 ? '-' : '+'}{Math.abs(donationBalance.balance).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Balance</div>
            </div>
          </div>
        </div>

        {/* Player Notes */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Player Notes</h3>
            <LeadershipGuard
              requiredPermission="canModifyClanData"
              fallback={null}
            >
              <Button
                onClick={() => setIsEditing(!isEditing)}
                variant="outline"
                size="sm"
              >
                {isEditing ? 'Cancel' : 'Add Note'}
              </Button>
            </LeadershipGuard>
          </div>

          {/* Display existing notes */}
          <div className="space-y-3 mb-4">
            {notes.length === 0 ? (
              <p className="text-gray-500 italic">No notes yet</p>
            ) : (
              notes.map((note, index) => (
                <div key={index} className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-gray-500">
                      {formatDate(note.timestamp)}
                    </span>
                    {note.addedBy && (
                      <span className="text-xs text-gray-400">
                        by {note.addedBy}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-800">{note.note}</p>
                </div>
              ))
            )}
          </div>

          {/* Add new note */}
          {isEditing && (
            <div className="space-y-3">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note about this player..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
              <div className="flex gap-2">
                <SuccessButton
                  onClick={handleSaveNote}
                  disabled={!newNote.trim()}
                  size="sm"
                >
                  Save Note
                </SuccessButton>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setNewNote('');
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Custom Fields */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Custom Fields</h3>
          <div className="space-y-3">
            {Object.entries(customFields).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-600 w-32">
                  {key}:
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setCustomFields(prev => ({
                    ...prev,
                    [key]: e.target.value
                  }))}
                  className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            ))}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="New field name"
                className="w-32 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    const fieldName = input.value.trim();
                    if (fieldName && !customFields[fieldName]) {
                      setCustomFields(prev => ({
                        ...prev,
                        [fieldName]: ''
                      }));
                      input.value = '';
                    }
                  }
                }}
              />
              <span className="text-sm text-gray-500">Press Enter to add</span>
            </div>
            <Button
              onClick={handleSaveCustomFields}
              variant="outline"
              size="sm"
            >
              Save Fields
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PlayerProfileModal;
