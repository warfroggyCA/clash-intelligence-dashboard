import Link from 'next/link';
import { Card } from '@/components/new-ui/Card';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default function JoinInfoPage() {
  const clanTag = normalizeTag(cfg.homeClanTag || '') || '#2PR8R8V8P';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">Join Heck Yeah</h1>
          <p className="text-slate-400">
            This site is currently a private portal for Heck Yeah members.
          </p>
        </div>

        <Card className="p-6 border-white/10 bg-slate-900/50 backdrop-blur-xl">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-white">Already in Heck Yeah?</div>
              <div className="text-sm text-slate-400">
                Go to the access flow and verify your in-game account.
              </div>
            </div>

            <div>
              <Link
                href="/home"
                className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 font-bold text-slate-900 bg-[var(--accent)] shadow-[var(--shadow-neon)]"
              >
                Go to Heck Yeah Access
              </Link>
            </div>

            <hr className="border-white/10" />

            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Not in Heck Yeah yet?</div>
              <div className="text-sm text-slate-400">
                In Clash of Clans, search for the clan tag:
              </div>
              <div className="font-mono text-cyan-300 text-lg">{clanTag}</div>
              <div className="text-xs text-slate-500">
                Once you&apos;re in the clan (and after the next roster sync), come back to
                <span className="font-mono"> /home</span> and verify.
              </div>
            </div>
          </div>
        </Card>

        <div className="text-[10px] text-slate-600 uppercase tracking-[0.3em] text-center">
          Clash Intelligence
        </div>
      </div>
    </div>
  );
}
