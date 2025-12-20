import { headers } from 'next/headers';
import { getClanConfigByHost, getClanConfigBySlug, DEFAULT_CLAN_CONFIG, type ClanHostConfig } from '@/lib/clan-config';

export async function getActiveClanConfig(): Promise<ClanHostConfig> {
  const incomingHeaders = await headers();
  const slugHeader = incomingHeaders.get('x-clan-slug');
  if (slugHeader) {
    const viaSlug = getClanConfigBySlug(slugHeader);
    if (viaSlug) {
      return viaSlug;
    }
  }
  const host = incomingHeaders.get('x-forwarded-host') || incomingHeaders.get('host');
  return getClanConfigByHost(host) ?? DEFAULT_CLAN_CONFIG;
}

