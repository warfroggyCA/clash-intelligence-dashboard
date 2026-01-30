"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/new-ui/Button';
import type { ClanHostConfig } from '@/lib/clan-config';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { syncServerSession } from '@/lib/auth/session-sync';

interface AdminLoginFormClientProps {
  clanConfig: ClanHostConfig;
}

export function AdminLoginFormClient({ clanConfig }: AdminLoginFormClientProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push('/new');
      }
    };
    void checkUser();
  }, [supabase.auth, router]);

  const resolveLoginEmail = (value: string): string => {
    if (value.includes('@')) {
      return value.trim();
    }
    const username = value.replace(/\s+/g, '').toLowerCase();
    return `${username}@clashintelligence.local`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const loginEmail = resolveLoginEmail(identifier);
      const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        await syncServerSession('SIGNED_IN', sessionData?.session ?? null);
        router.push('/new');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-clash-gold/60 bg-slate-900/70 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
            <span className="text-2xl">🛡️</span>
          </div>
          <p className="text-xs uppercase tracking-[0.35em] text-clash-gold/80">{clanConfig.displayName}</p>
          <h1 className="text-4xl font-semibold">Owner / Admin Portal</h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            For dashboard owners and admins. Clan members should use token sign-in.
          </p>
          <p className="text-xs text-slate-500">
            Looking for the member flow?{' '}
            <Link href="/login" className="text-clash-gold hover:underline">
              Go to /login
            </Link>
          </p>
        </div>

        <div className="w-full max-w-xl rounded-[32px] border border-clash-gold/40 bg-slate-900/70 px-8 py-10 shadow-[0_35px_90px_-35px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-slate-200">
                Admin Email
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-2 block w-full rounded-2xl border border-slate-700/70 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-clash-gold focus:border-clash-gold"
                placeholder="Enter admin email"
              />
              <p className="mt-2 text-xs text-slate-400">
                Admin accounts can use a real email or an internal username (mapped to <span className="font-mono">@clashintelligence.local</span>).
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-200">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 block w-full rounded-2xl border border-slate-700/70 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-clash-gold focus:border-clash-gold"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
            )}

            <div className="space-y-3">
              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl border-0 bg-gradient-to-r from-clash-orange to-clash-gold text-slate-950 shadow-[0_15px_30px_rgba(253,199,76,0.35)] transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-clash-gold"
                size="lg"
              >
                {loading ? 'Please wait…' : 'Sign In'}
              </Button>
            </div>
          </form>
        </div>

        <div className="text-center text-xs uppercase tracking-[0.3em] text-slate-500">
          Secure access only
        </div>
      </div>
    </div>
  );
}
