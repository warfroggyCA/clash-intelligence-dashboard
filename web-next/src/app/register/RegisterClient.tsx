"use client";

import { useState } from 'react';
import { Copy, ShieldCheck, Sparkles } from 'lucide-react';
import type { ClanHostConfig } from '@/lib/clan-config';
import type { PendingRegistration } from '@/types';
import { Button, GlassCard } from '@/components/ui';

interface RegisterClientProps {
  clanConfig: ClanHostConfig;
}

const STEP_ITEMS = [
  {
    title: 'Enter your player tag',
    description: 'Use the exact tag shown in Clash of Clans (starts with #).',
  },
  {
    title: 'Get your verification code',
    description: 'We generate a short code you can paste in clan chat.',
  },
  {
    title: 'Post it in clan chat',
    description: 'Tell leadership “Verifying for the dashboard” so they can match it.',
  },
  {
    title: 'Leader approves access',
    description: 'Dashboard automatically unlocks once a leader approves the request.',
  },
];

const STATUS_STYLES: Record<PendingRegistration['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-100 border border-amber-400/40',
  approved: 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/40',
  rejected: 'bg-rose-500/15 text-rose-100 border border-rose-400/40',
  expired: 'bg-slate-500/15 text-slate-200 border border-slate-500/40',
};

export default function RegisterClient({ clanConfig }: RegisterClientProps) {
  const [playerTag, setPlayerTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [info, setInfo] = useState<string>('');
  const [registration, setRegistration] = useState<PendingRegistration | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!playerTag.trim()) {
      setError('Enter your player tag first');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');
    setCopyState('idle');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerTag }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Registration failed');
      }

      const newRegistration = payload.data?.registration as PendingRegistration;
      setRegistration(newRegistration ?? null);
      setInfo(payload.message || 'Share this code in clan chat for approval.');
    } catch (err: any) {
      setRegistration(null);
      setError(err?.message || 'Could not create registration');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!registration?.verificationCode) return;
    try {
      await navigator.clipboard.writeText(registration.verificationCode);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (copyError) {
      setError('Unable to copy automatically. Highlight the code and copy manually.');
    }
  };

  const expiresText = registration?.expiresAt
    ? new Date(registration.expiresAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const statusStyle = registration?.status ? STATUS_STYLES[registration.status] ?? STATUS_STYLES.pending : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 px-4 py-12 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-clash-gold/80">{clanConfig.displayName}</p>
          <h1 className="text-4xl font-semibold">Request clan dashboard access</h1>
          <p className="text-base text-slate-300 md:text-lg">
            No email required. Verify your Clash account by posting a one-time code in clan chat. Leaders approve you right inside the dashboard.
          </p>
        </header>

        <div className="grid gap-8 md:grid-cols-[1.15fr_0.85fr]">
          <GlassCard className="bg-slate-900/70">
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/5 bg-white/5 p-5">
                <div className="flex items-center gap-3 text-slate-200">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-slate-950/60 text-lg">#</span>
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-clash-gold/70">Step 1</p>
                    <p className="text-lg font-semibold">Enter your player tag</p>
                  </div>
                </div>
                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                  <label htmlFor="playerTag" className="text-sm font-medium text-slate-200">
                    Clash of Clans Player Tag
                  </label>
                  <input
                    id="playerTag"
                    name="playerTag"
                    type="text"
                    required
                    value={playerTag}
                    onChange={(event) => setPlayerTag(event.target.value)}
                    placeholder="#2PR8R8V8P"
                    className="w-full rounded-2xl border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-base text-white placeholder-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-clash-gold"
                  />
                  <p className="text-xs text-slate-400">
                    Format matters &mdash; include the leading #. We validate it against the live clan roster before issuing a code.
                  </p>
                  {error && (
                    <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
                      {error}
                    </div>
                  )}
                  {info && (
                    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                      {info}
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={loading}
                    variant="primary"
                    className="w-full rounded-2xl"
                  >
                    {loading ? 'Generating code…' : 'Generate Verification Code'}
                  </Button>
                </form>
              </div>

              {registration && (
                <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 shadow-inner">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Verification code</p>
                      <p className="text-3xl font-bold tracking-wider text-white">{registration.verificationCode}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-2xl border border-white/10 bg-transparent px-4 text-white hover:bg-white/5"
                      onClick={handleCopyCode}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {copyState === 'copied' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                    <span className={`rounded-2xl px-3 py-1 text-xs font-semibold uppercase tracking-widest ${statusStyle}`}>
                      {registration.status}
                    </span>
                    {expiresText && <span>Expires {expiresText}</span>}
                  </div>
                  <dl className="mt-4 grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-400">Player tag</dt>
                      <dd className="font-semibold text-white">{registration.playerTag}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Clan</dt>
                      <dd className="font-semibold text-white">{clanConfig.displayName}</dd>
                    </div>
                  </dl>
                  <p className="mt-5 rounded-2xl border border-slate-700/40 bg-slate-900/60 p-4 text-sm text-slate-300">
                    Post the code exactly as shown in your clan chat. Leaders approve from the dashboard and you can sign in right away (username or email depending on your account preference).
                  </p>
                </div>
              )}
            </div>
          </GlassCard>

          <div className="space-y-6">
            <GlassCard className="bg-slate-900/60">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-clash-gold" />
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Secure workflow</p>
                  <h2 className="text-xl font-semibold text-white">What happens next</h2>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                {STEP_ITEMS.map((step, index) => (
                  <div
                    key={step.title}
                    className="flex gap-4 rounded-2xl border border-white/5 bg-white/5 p-4"
                  >
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-950/70 text-sm font-semibold text-clash-gold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <p className="text-sm text-slate-300">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="bg-slate-900/60">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-clash-gold" />
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Need to know</p>
                  <h2 className="text-xl font-semibold text-white">FAQ for registrants</h2>
                </div>
              </div>
              <ul className="mt-4 space-y-4 text-sm text-slate-300">
                <li>
                  <span className="font-semibold text-slate-100">Do I need email?</span>
                  <p>Not required. Leaders can set up username-only accounts. If you provide email later you can enable notifications.</p>
                </li>
                <li>
                  <span className="font-semibold text-slate-100">What if I can’t copy the code?</span>
                  <p>You can also screenshot or re-request the code after it expires. Codes last 24 hours per clan.</p>
                </li>
                <li>
                  <span className="font-semibold text-slate-100">Who approves me?</span>
                  <p>Only your clan’s leadership team. They see the request instantly inside the dashboard.</p>
                </li>
                <li>
                  <span className="font-semibold text-slate-100">Need help?</span>
                  <p>Ping a leader in clan chat or email info@clashintelligence.com.</p>
                </li>
              </ul>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
