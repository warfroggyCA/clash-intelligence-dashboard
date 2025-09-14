import CoCRateLimiter from '../lib/rate-limiter';

describe('rateLimiter', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('queues and releases sequentially', async () => {
    const limiter = new CoCRateLimiter({ maxConcurrent: 1, minInterval: 0, debug: false });
    const starts: number[] = [];
    const tasks = Array.from({ length: 5 }, async () => {
      await limiter.acquire();
      try {
        starts.push(Date.now());
      } finally {
        limiter.release();
      }
    });

    await Promise.all(tasks);
    expect(starts.length).toBe(5);
  });

  test('honors maxConcurrent with zero interval', async () => {
    const limiter = new CoCRateLimiter({ maxConcurrent: 2, minInterval: 0, debug: false });
    const grants: number[] = [];

    // Schedule 5 acquires without releasing immediately
    const acquired: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      acquired.push(limiter.acquire().then(() => { grants.push(i); }));
    }

    // Allow microtasks to run
    await Promise.resolve();
    // With maxConcurrent=2, at most 2 should be active
    expect(limiter.getActiveCount()).toBe(2);

    // Now release both and ensure next two proceed
    limiter.release();
    limiter.release();

    await Promise.resolve();
    // Active should climb back to 2 again as next two start
    expect(limiter.getActiveCount()).toBe(2);

    // Release remaining
    limiter.release();
    limiter.release();
    await Promise.resolve();
    // Last one should start
    expect(limiter.getActiveCount()).toBe(1);
    limiter.release();
    await Promise.all(acquired);
    expect(grants.length).toBe(5);
  });
});
