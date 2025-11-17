import { cfg } from '@/lib/config';

export type ClanHostConfig = {
  slug: string;
  displayName: string;
  clanTag: string;
  hostnames: string[];
  marketingOnly?: boolean;
  theme?: {
    accent?: string;
    hero?: string;
  };
};

const CLAN_CONFIGS: ClanHostConfig[] = [
  {
    slug: 'clash-intelligence',
    displayName: 'Clash Intelligence',
    clanTag: cfg.homeClanTag,
    hostnames: ['clashintelligence.com', 'www.clashintelligence.com'],
    marketingOnly: true,
  },
  {
    slug: 'heckyeah',
    displayName: 'HeckYeah',
    clanTag: cfg.homeClanTag,
    hostnames: [
      'heckyeah.clashintelligence.com',
      'heckyeah.localhost',
      'heckyeah.localhost.localdomain',
      'heckyeah.local',
    ],
    marketingOnly: false,
    theme: {
      accent: '#F97316',
    },
  },
];

const CONFIG_BY_HOST = new Map<string, ClanHostConfig>();
const CONFIG_BY_SLUG = new Map<string, ClanHostConfig>();

for (const config of CLAN_CONFIGS) {
  CONFIG_BY_SLUG.set(config.slug, config);
  for (const host of config.hostnames) {
    CONFIG_BY_HOST.set(host.toLowerCase(), config);
  }
}

export const DEFAULT_CLAN_CONFIG: ClanHostConfig = {
  slug: 'default',
  displayName: 'Clash Intelligence',
  clanTag: cfg.homeClanTag,
  hostnames: [],
  marketingOnly: true,
};

export function getClanConfigByHost(host?: string | null): ClanHostConfig | null {
  if (!host) return null;
  const normalized = host.toLowerCase().split(':')[0];
  return CONFIG_BY_HOST.get(normalized) ?? null;
}

export function getClanConfigBySlug(slug?: string | null): ClanHostConfig | null {
  if (!slug) return null;
  return CONFIG_BY_SLUG.get(slug) ?? null;
}

export function listClanConfigs(): ClanHostConfig[] {
  return CLAN_CONFIGS.slice();
}
