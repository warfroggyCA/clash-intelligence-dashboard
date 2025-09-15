import { unstable_cache as unstableCache } from 'next/cache';

/**
 * Small helper over Next.js unstable_cache to enable brief cross-request
 * deduplication for read endpoints. Returns the cached function result.
 */
export async function cached<T>(
  key: string | string[],
  fn: () => Promise<T>,
  revalidateSeconds = 10,
): Promise<T> {
  const keys = Array.isArray(key) ? key : [key];
  const runner = unstableCache(fn, keys, { revalidate: revalidateSeconds });
  return runner();
}

