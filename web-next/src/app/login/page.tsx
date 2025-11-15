"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
          setActiveSessionEmail(session.user?.email ?? null);
        router.push('/app');
      }
    };
    checkUser();
  }, [supabase.auth, router]);

  const logoutCurrentSession = useCallback(async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        cache: 'no-store',
      }).catch(() => {
        // ignore failures here; client sign-out still runs
      });
      await supabase.auth.signOut();
    } catch (logoutError) {
      console.warn('[login] Failed to clear existing session', logoutError);
    }
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        setError(error.message);
      } else {
        router.push('/app');
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
            <span className="text-2xl">⚔️</span>
          </div>
          <p className="text-xs uppercase tracking-[0.35em] text-clash-gold/80">
            Clash Intelligence
          </p>
          <h1 className="text-4xl font-semibold">Leadership Access Portal</h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Sign in to access the Clash Intelligence dashboard and keep your clan&rsquo;s intel in one command center.
          </p>
        </div>

        <div className="w-full max-w-xl rounded-[32px] border border-clash-gold/40 bg-slate-900/70 px-8 py-10 shadow-[0_35px_90px_-35px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-200">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 block w-full rounded-2xl border border-slate-700/70 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-clash-gold focus:border-clash-gold"
                placeholder="Enter your email"
              />
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
              <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl border-0 bg-gradient-to-r from-clash-orange to-clash-gold text-slate-950 shadow-[0_15px_30px_rgba(253,199,76,0.35)] transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-clash-gold"
                size="lg"
              >
                {loading ? 'Please wait...' : 'Sign In'}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Need access? Contact your clan leadership—they provision accounts inside the dashboard.
          </div>
        </div>

        <div className="text-center text-xs uppercase tracking-[0.3em] text-slate-500">
          Built for leadership • Secure access only
        </div>
      </div>
    </div>
  );
}
