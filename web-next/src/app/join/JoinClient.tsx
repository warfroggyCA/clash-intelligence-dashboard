"use client";

import { useState, useMemo, useEffect, useDeferredValue, useCallback, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/new-ui/Button';
import { Card } from '@/components/new-ui/Card';
import { Search, ShieldCheck, ChevronRight } from 'lucide-react';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { syncServerSession } from '@/lib/auth/session-sync';

interface PublicMember {
  tag: string;
  name: string;
  th: number;
  role: string;
}

export default function JoinClient({ roster }: { roster: PublicMember[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedMember, setSelectedMember] = useState<PublicMember | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredRoster = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();

    // Keep results manageable: require at least 2 characters.
    if (q.length < 2) return [];

    // Search by in-game name only (tags are shown, but not used for matching).
    const matches = roster.filter((m) => m.name.toLowerCase().includes(q));

    // Prefer starts-with matches first.
    matches.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    });

    return matches.slice(0, 8);
  }, [roster, deferredSearch]);

  useEffect(() => {
    // Reset selection whenever the result set changes.
    setActiveIndex(0);
  }, [deferredSearch, filteredRoster.length]);

  const selectMember = useCallback((member: PublicMember) => {
    setSelectedMember(member);
    setStep(2);
    setError(null);
  }, []);

  const onSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (filteredRoster.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filteredRoster.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const member = filteredRoster[activeIndex];
        if (member) selectMember(member);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSearch('');
      }
    },
    [activeIndex, filteredRoster, selectMember]
  );

  const handleVerify = async () => {
    if (!selectedMember || !token.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Backend verification and user prep
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerTag: selectedMember.tag,
          apiToken: token.trim(),
        }),
      });

      const magic = await res.json();
      if (!res.ok || !magic.success) {
        throw new Error(magic.error || 'Verification failed');
      }

      // 2. Perform the actual Supabase sign-in on the client
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
        email: magic.data.email,
        password: token.trim(),
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      // 3. Sync and go
      await syncServerSession('SIGNED_IN', sessionData?.session ?? null);
      router.push('/new');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-2">
            <ShieldCheck className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Heck Yeah Access</h1>
          <p className="text-slate-400 text-sm">
            Pick your account, then sign in with your Clash of Clans API token.
          </p>
        </div>

        <Card className="p-6 border-white/10 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Step 1: Find your account
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={onSearchKeyDown}
                    placeholder="Type your player name..."
                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-cyan-500/50 outline-none transition-all"
                    autoFocus
                    role="combobox"
                    aria-expanded={filteredRoster.length > 0}
                    aria-controls="roster-results"
                    aria-autocomplete="list"
                    aria-activedescendant={
                      filteredRoster[activeIndex] ? `roster-option-${filteredRoster[activeIndex].tag}` : undefined
                    }
                  />
                </div>
              </div>

              <div
                id="roster-results"
                role="listbox"
                className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar"
              >
                {filteredRoster.map((member, idx) => {
                  const active = idx === activeIndex;

                  return (
                    <button
                      key={member.tag}
                      id={`roster-option-${member.tag}`}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => selectMember(member)}
                      className={
                        "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group " +
                        (active
                          ? "border-cyan-500/40 bg-cyan-500/10"
                          : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20")
                      }
                    >
                      <div className="flex items-center gap-3">
                        <TownHallIcon level={member.th} size="sm" />
                        <div>
                          <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                            {member.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{member.tag}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300" />
                    </button>
                  );
                })}
                
                {search.trim().length >= 2 && filteredRoster.length === 0 && (
                  <div className="py-8 text-center text-slate-500 text-sm italic">
                    No matching members found in the current roster.
                  </div>
                )}

                {search.trim().length > 0 && search.trim().length < 2 && (
                  <div className="py-8 text-center text-slate-500 text-sm italic">
                    Type at least 2 letters of your in-game name.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <TownHallIcon level={selectedMember?.th} size="sm" />
                  <div>
                    <div className="font-bold text-white">{selectedMember?.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{selectedMember?.tag}</div>
                  </div>
                </div>
                <button 
                  onClick={() => setStep(1)}
                  className="text-xs text-cyan-400 hover:underline"
                >
                  Change
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Step 2: Enter API Token
                  </label>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Your in-game API token is your password.
                    <br />
                    <span className="text-slate-500 italic">Find it in-game: Settings → More Settings → API Token</span>
                  </p>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !loading && token.trim().length >= 8) {
                        e.preventDefault();
                        handleVerify();
                      }
                    }}
                    placeholder="Paste token here..."
                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-slate-600 focus:border-cyan-500/50 outline-none transition-all font-mono"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium">
                    {error}
                  </div>
                )}

                <Button
                  tone="primary"
                  className="w-full py-6 text-lg shadow-xl shadow-cyan-500/10"
                  disabled={loading || token.length < 8}
                  onClick={handleVerify}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </Button>
                
                <p className="text-[10px] text-center text-slate-500 uppercase tracking-tighter">
                  No email · No extra password · Token required on new devices
                </p>
              </div>
            </div>
          )}
        </Card>

        <div className="text-center space-y-2">
          <div className="text-[10px] text-slate-600 uppercase tracking-[0.3em]">
            Secure Access • Clash Intelligence
          </div>

          <div className="text-xs text-slate-500">
            Not in Heck Yeah?{' '}
            <a
              href="/join"
              className="text-cyan-400 hover:underline"
            >
              Learn how to join
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
