import Link from 'next/link';
import { getActiveClanConfig } from '@/lib/active-clan';
import { listClanConfigs } from '@/lib/clan-config';
import { LoginFormClient } from './LoginFormClient';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const clanConfig = await getActiveClanConfig();
  if (clanConfig.marketingOnly) {
    const clanHosts = listClanConfigs().filter((config) => !config.marketingOnly);
    return (
      <div className="min-h-screen bg-slate-950/95 text-slate-100 px-6 py-12">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-clash-gold/70">Clan access</p>
          <h1 className="text-4xl font-semibold">Choose your clan landing page</h1>
          <p className="text-sm text-slate-400">
            The generic Clash Intelligence site doesn&rsquo;t host sign-ins. Use your clan&rsquo;s subdomain so every roster, warning, and onboarding step stays in the right command center.
          </p>
          <div className="rounded-3xl border border-white/5 bg-slate-900/80 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Available clan portals</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {clanHosts.map((config) => {
                // In dev, we want to route to the local wildcard host (e.g. heckyeah.localhost:5050)
                // instead of the production hostname.
                const useHttp = process.env.NEXT_PUBLIC_USE_HTTP_LINKS === 'true';
                const protocol = useHttp ? 'http://' : 'https://';

                const preferredLocalHost = config.hostnames.find((host) => host.includes('localhost'));
                const preferredProdHost = config.hostnames.find((host) => host.includes('clashintelligence.com'));

                let targetHost = useHttp
                  ? (preferredLocalHost ?? `${config.slug}.localhost`)
                  : (preferredProdHost ?? config.hostnames[0] ?? `${config.slug}.clashintelligence.com`);

                targetHost = targetHost.replace(/^https?:\/\//, '');

                // If we’re using localhost wildcard domains, ensure we include the dev port.
                if (useHttp && !targetHost.includes(':')) {
                  targetHost = `${targetHost}:5050`;
                }

                return (
                  <Link
                    key={config.slug}
                    href={`${protocol}${targetHost}/login`}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm font-semibold text-white transition hover:border-clash-gold/60 hover:text-clash-gold"
                  >
                    {config.displayName}
                  </Link>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Need a new clan portal? Email <a href="mailto:info@clashintelligence.com" className="text-clash-gold">info@clashintelligence.com</a> and we&rsquo;ll get you set up.
          </p>
        </div>
      </div>
    );
  }

  return <LoginFormClient clanConfig={clanConfig} />;
}
