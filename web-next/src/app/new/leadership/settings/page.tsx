"use client";

import React, { useState, useEffect } from 'react';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import { 
  Shield, 
  Eye, 
  Lock, 
  Globe, 
  Users, 
  Swords, 
  Save,
  CheckCircle2,
  Trophy,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { cfg } from '@/lib/config';

export default function LeadershipSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Granular State
  const [settings, setSettings] = useState({
    rosterVisibility: 'public',
    showMinis: true,
    allowMemberSearch: true,
    warPlannerAccess: 'coleader',
    warHistoryVisibility: 'clan',
    vipVisibility: 'clan',
    leaderboardEnabled: true,
    autoSyncRoles: true,
    ingestionAlerts: true
  });

  const clanTag = cfg.homeClanTag;

  // Load Settings
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/leadership/settings?clanTag=${encodeURIComponent(clanTag || '')}`);
        const json = await res.json();
        if (json.success && json.data) {
          // Merge loaded settings with defaults to handle missing keys
          setSettings(prev => ({ ...prev, ...json.data }));
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [clanTag]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/leadership/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag, settings }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ active, onClick, color = 'bg-cyan-500' }: { active: boolean, onClick: () => void, color?: string }) => (
    <button 
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${active ? color : 'bg-slate-700'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  const RadioGroup = ({ value, options, onChange, activeColor = 'border-clash-gold bg-clash-gold/10 text-clash-gold' }: any) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {options.map((opt: any) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all text-center ${
            value === opt.value ? activeColor : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading settings...</div>;
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-24 px-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-clash-gold/20 rounded-xl">
            <Shield className="w-6 h-6 text-clash-gold" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Clan Settings</h1>
        </div>
        <p className="text-slate-400 text-sm">Configure granular permissions and visibility for each section.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid gap-6">
        {/* ROSTER */}
        <Card title={<div className="flex items-center gap-2 text-cyan-400"><Users className="w-4 h-4" /><span>Roster & Identity</span></div>}>
          <div className="space-y-6 pt-2">
            <div>
              <label className="text-sm font-medium text-slate-200 block mb-3">Roster Visibility</label>
              <RadioGroup 
                value={settings.rosterVisibility}
                onChange={(val: any) => setSettings(s => ({ ...s, rosterVisibility: val }))}
                options={[
                  { label: 'Public', value: 'public' },
                  { label: 'Clan Only', value: 'clan' },
                  { label: 'Leadership', value: 'leadership' }
                ]}
              />
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-4">
              <div>
                <div className="text-sm font-medium text-white">Linked Mini-Accounts</div>
                <div className="text-xs text-slate-500">Show alternate accounts on profiles.</div>
              </div>
              <Toggle active={settings.showMinis} onClick={() => setSettings(s => ({ ...s, showMinis: !s.showMinis }))} />
            </div>
          </div>
        </Card>

        {/* WAR */}
        <Card title={<div className="flex items-center gap-2 text-rose-400"><Swords className="w-4 h-4" /><span>War & Strategy</span></div>}>
          <div className="space-y-6 pt-2">
            <div>
              <label className="text-sm font-medium text-slate-200 block mb-3">War Planner Access</label>
              <RadioGroup 
                value={settings.warPlannerAccess}
                activeColor="border-rose-500 bg-rose-500/10 text-rose-400"
                onChange={(val: any) => setSettings(s => ({ ...s, warPlannerAccess: val }))}
                options={[
                  { label: 'Elder+', value: 'elder' },
                  { label: 'Co-Leader+', value: 'coleader' },
                  { label: 'Leader Only', value: 'leader' }
                ]}
              />
            </div>
          </div>
        </Card>

        {/* PERFORMANCE */}
        <Card title={<div className="flex items-center gap-2 text-emerald-400"><Trophy className="w-4 h-4" /><span>Performance & VIP</span></div>}>
          <div className="space-y-6 pt-2">
            <div>
              <label className="text-sm font-medium text-slate-200 block mb-3">Score Visibility</label>
              <RadioGroup 
                value={settings.vipVisibility}
                activeColor="border-emerald-500 bg-emerald-500/10 text-emerald-400"
                onChange={(val: any) => setSettings(s => ({ ...s, vipVisibility: val }))}
                options={[
                  { label: 'Private', value: 'private' },
                  { label: 'Clan Only', value: 'clan' },
                  { label: 'Public', value: 'public' }
                ]}
              />
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-4">
              <div>
                <div className="text-sm font-medium text-white">Global Leaderboard</div>
                <div className="text-xs text-slate-500">Show Top 5 performers on dashboard.</div>
              </div>
              <Toggle active={settings.leaderboardEnabled} color="bg-emerald-500" onClick={() => setSettings(s => ({ ...s, leaderboardEnabled: !s.leaderboardEnabled }))} />
            </div>
          </div>
        </Card>

        {/* AUTOMATION */}
        <Card title={<div className="flex items-center gap-2 text-purple-400"><RefreshCw className="w-4 h-4" /><span>Automation & Sync</span></div>}>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Auto-Sync Roles</div>
                <div className="text-xs text-slate-500">Map in-game ranks to site permissions.</div>
              </div>
              <Toggle active={settings.autoSyncRoles} color="bg-purple-500" onClick={() => setSettings(s => ({ ...s, autoSyncRoles: !s.autoSyncRoles }))} />
            </div>
          </div>
        </Card>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-5xl z-50">
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl">
          <div className="flex-1 min-w-0 text-xs text-slate-400">
            {saved ? <span className="text-emerald-400 font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Saved!</span> : 'Immediate effect.'}
          </div>
          <Button onClick={handleSave} loading={saving} disabled={saving} tone="primary" className="px-6 shadow-lg shadow-clash-gold/20">
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}
