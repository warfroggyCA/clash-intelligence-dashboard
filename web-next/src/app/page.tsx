import Link from "next/link";
import { getActiveClanConfig } from '@/lib/active-clan';

const heroStats = [
  { label: "War plans automated", value: "480+" },
  { label: "Capital raid weekends analyzed", value: "190+" },
  { label: "Clan accounts provisioned", value: "60+" },
];

const features = [
  {
    title: "War Performance Intelligence",
    body: "Battle-tested scoring for every attack and defense. Spot sandbaggers, coach vulnerabilities, and publish an action plan before match spin completes.",
    badge: "ACE • WPIE",
  },
  {
    title: "Capital ROI + Carry Tracking",
    body: "Surface true carry value, loot-to-funnel ROI, and week-over-week participation using the Capital Analytics Engine.",
    badge: "Capital Analytics",
  },
  {
    title: "Secure Clan Operations",
    body: "Role-aware ingestion triggers, audit logs, and AI-generated insights that respect every member's permissions while keeping sensitive data locked down.",
    badge: "Access Control",
  },
];

export default async function LandingPage() {
  const clanConfig = await getActiveClanConfig();
  const isClanHost = !clanConfig.marketingOnly;
  const marketingHero = "The war room for modern clans in Clash of Clans.";
  const heroHeading = clanConfig.marketingOnly ? marketingHero : clanConfig.theme?.hero || null;
  const primaryHref = isClanHost ? '/onboarding' : '/login';
  const primaryLabel = isClanHost ? 'Complete onboarding' : 'Enter Dashboard';
  const secondaryHref = isClanHost ? '/login' : '/faq';
  const secondaryLabel = isClanHost ? 'Sign in' : 'View playbook →';
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {!clanConfig.marketingOnly && (
        <div className="bg-amber-500/10 border-b border-amber-400/30 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-100">
          {`Serving the ${clanConfig.displayName} deployment`}
        </div>
      )}
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.08),transparent_55%)]" />
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
          <div className="flex items-center gap-3 text-sm font-semibold tracking-wide text-slate-200">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg">
              ⚔️
            </span>
            <span>Clash Intelligence Dashboard</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            <Link
              href="/login"
              className="rounded-full border border-slate-700/70 px-4 py-2 text-slate-200 transition hover:border-clash-gold hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="mailto:info@clashintelligence.com"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-clash-orange to-clash-gold px-4 py-2 text-slate-950 shadow-[0_12px_35px_-18px_rgba(253,199,76,0.55)] transition hover:opacity-90"
            >
              Request Access
            </Link>
          </div>
        </header>

        <section className="mx-auto flex max-w-6xl flex-col gap-10 px-5 pb-14 pt-6 sm:px-8 md:flex-row md:items-center">
          <div className="flex-1 space-y-8">
            <p className="text-xs uppercase tracking-[0.4em] text-clash-gold/70">Clash Intelligence Dashboard</p>
            <div className="space-y-6">
              <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                {clanConfig.marketingOnly ? (
                  marketingHero
                ) : heroHeading ? (
                  heroHeading
                ) : (
                  <>
                    Welcome to{' '}
                    <span style={{ fontFamily: '"Clash Display", "Plus Jakarta Sans", sans-serif' }}>
                      {clanConfig.displayName}
                    </span>
                  </>
                )}
              </h1>
              <p className="text-base text-slate-300 sm:text-lg">
                The Clash Intelligence Dashboard is your command center for roster health, war intelligence, capital ROI, and player development. Every insight is clan-aware,
                authenticated, and ready from first scout to final hit.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                href={primaryHref}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-clash-orange to-clash-gold px-6 py-3 text-base font-semibold text-slate-950 shadow-[0_18px_40px_-20px_rgba(253,199,76,0.7)] transition hover:opacity-95"
              >
                {primaryLabel}
              </Link>
              <Link
                href={secondaryHref}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-base font-semibold text-slate-100 transition hover:border-clash-gold/80"
              >
                {secondaryLabel}
              </Link>
            </div>
            <dl className="grid gap-6 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-xs uppercase tracking-[0.28em] text-slate-500">{stat.label}</dt>
                  <dd className="text-2xl font-semibold text-white">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex-1">
            <div className="rounded-[36px] border border-white/10 bg-white/5 p-6 shadow-[0_55px_120px_-60px_rgba(15,23,42,0.9)] backdrop-blur">
              <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-slate-400">
                <span>Live command preview</span>
                <span>Secure · Clan-aware</span>
              </div>
              <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">War briefing</p>
                    <p className="text-lg font-semibold text-white">Clan intelligence digest</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">Ready</span>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 text-sm text-slate-300">
                  Today’s snapshot highlights top performers, carry deficits, and raid ROI in one glance. Promotions, warnings, and AI
                  coaching prompts route directly to your Discord workflows.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">War intelligence</p>
                    <p className="text-2xl font-semibold text-white">92.4</p>
                    <p className="text-xs text-slate-400">Attack efficiency index this week.</p>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Capital ROI</p>
                    <p className="text-2xl font-semibold text-white">118%</p>
                    <p className="text-xs text-slate-400">Loot to upgrade velocity, last 3 raids.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="text-xs uppercase tracking-[0.35em] text-clash-gold/70">Why clans switch</p>
        <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Everything your clan touches in one pane.</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-3xl border border-white/5 bg-slate-900/70 p-6 shadow-[0_30px_60px_-50px_rgba(15,23,42,1)]">
              <span className="text-xs font-semibold uppercase tracking-[0.32em] text-clash-gold/70">{feature.badge}</span>
              <h3 className="mt-3 text-2xl font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
        <div className="rounded-[32px] border border-white/10 bg-gradient-to-r from-slate-900/80 via-slate-900 to-slate-900/80 p-10 text-center shadow-[0_60px_120px_-80px_rgba(15,23,42,1)]">
          <p className="text-xs uppercase tracking-[0.35em] text-clash-gold/70">Ready when you are</p>
          <h3 className="mt-4 text-3xl font-semibold text-white">Lock down your clan intelligence.</h3>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            Sign in if you already have access. Need credentials? Reach out and we’ll onboard your clan.
          </p>
          <div className="mt-6 flex flex-wrap justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-clash-orange to-clash-gold px-6 py-3 text-base font-semibold text-slate-950 shadow-[0_18px_40px_-20px_rgba(253,199,76,0.7)] transition hover:opacity-95"
            >
              Sign in to dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
