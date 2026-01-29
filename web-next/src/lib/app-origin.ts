import { headers } from 'next/headers';

type OriginOptions = {
  appUrl?: string | null;
  vercelUrl?: string | null;
  host?: string | null;
  proto?: string | null;
  defaultOrigin?: string;
};

const normalizeEnvUrl = (value?: string | null) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const resolveAppOrigin = (options: OriginOptions) => {
  const appUrl = normalizeEnvUrl(options.appUrl);
  if (appUrl) return appUrl;

  const vercelUrl = normalizeEnvUrl(options.vercelUrl);
  if (vercelUrl) return vercelUrl;

  const host = (options.host || '').trim();
  if (host) {
    const protoRaw = (options.proto || 'http').split(',')[0].trim();
    const proto = protoRaw || 'http';
    return `${proto}://${host}`;
  }

  return options.defaultOrigin || 'http://localhost:5050';
};

export const getRequestOrigin = async (
  headerOverrides?: Pick<Headers, 'get'>
) => {
  // In unit tests or non-request contexts, Next's `headers()` throws.
  // Allow injecting a stub and fall back to env/default.
  let headerList: Pick<Headers, 'get'> | null = null;
  if (headerOverrides) {
    headerList = headerOverrides;
  } else {
    try {
      headerList = await headers();
    } catch {
      headerList = null;
    }
  }

  return resolveAppOrigin({
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    vercelUrl: process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL,
    host: headerList?.get('x-forwarded-host') ?? headerList?.get('host') ?? null,
    proto: headerList?.get('x-forwarded-proto') ?? null,
    defaultOrigin: 'http://localhost:5050',
  });
};
