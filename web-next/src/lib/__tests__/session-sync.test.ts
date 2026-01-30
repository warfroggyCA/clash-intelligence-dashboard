import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { syncServerSession } from '@/lib/auth/session-sync';

describe('syncServerSession', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn(async () => new Response(null, { status: 200 })) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('POSTs event and session payload to auth callback', async () => {
    const session = {
      access_token: 'test-access',
      refresh_token: 'test-refresh',
    } as any;

    await syncServerSession('SIGNED_IN', session);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/callback',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'SIGNED_IN', session }),
      })
    );
  });

  it('swallows errors so UI never crashes during sync', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as any;

    await expect(syncServerSession('SIGNED_IN', null)).resolves.toBeUndefined();
  });
});

