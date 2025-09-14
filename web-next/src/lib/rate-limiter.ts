// web-next/src/lib/rate-limiter.ts
// Shared rate limiter for CoC API calls

type RateLimiterOptions = {
  maxConcurrent?: number;
  minInterval?: number;
  debug?: boolean;
};

class CoCRateLimiter {
  private queue: Array<() => void> = [];
  private active = 0;
  private lastRequest = 0;
  private readonly maxConcurrent: number;
  private readonly minInterval: number;
  private readonly debug: boolean;

  constructor(opts: RateLimiterOptions = {}) {
    this.maxConcurrent = opts.maxConcurrent ?? (process.env.NODE_ENV === 'development' ? 5 : 3);
    this.minInterval = opts.minInterval ?? (process.env.NODE_ENV === 'development' ? 100 : 700);
    this.debug = opts.debug ?? (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEBUG_LOGGING === 'true');
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.process();
    });
  }

  release(): void {
    this.active--;
    this.process();
  }

  private process(): void {
    if (this.queue.length === 0 || this.active >= this.maxConcurrent) return;

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      if (this.debug) {
        console.log(`[RateLimiter] Waiting ${waitTime}ms (queue: ${this.queue.length}, active: ${this.active})`);
      }
      setTimeout(() => this.process(), waitTime);
      return;
    }

    const resolve = this.queue.shift();
    if (resolve) {
      this.active++;
      this.lastRequest = now;
      if (this.debug) {
        console.log(`[RateLimiter] Processing (queue: ${this.queue.length}, active: ${this.active})`);
      }
      resolve();
    }
  }

  // Test helper
  getActiveCount() {
    return this.active;
  }
}

export const rateLimiter = new CoCRateLimiter();
export default CoCRateLimiter;
