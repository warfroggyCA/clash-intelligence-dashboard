/**
 * Retry utility for API calls
 * Provides exponential backoff and error categorization
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  retryableStatuses?: number[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatuses: [408, 429, 500, 502, 503, 504], // Timeout, Rate limit, Server errors
};

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  // If explicitly marked as non-retryable, don't retry
  if (error?.retryable === false) {
    return false;
  }

  // Network errors are retryable
  if (
    error?.message?.includes('fetch') ||
    error?.message?.includes('network') ||
    error?.message?.includes('Failed to fetch') ||
    error?.name === 'NetworkError' ||
    error?.code === 'NETWORK_ERROR'
  ) {
    return true;
  }

  // Check status code
  const status = error?.status || error?.response?.status;
  if (status && DEFAULT_OPTIONS.retryableStatuses.includes(status)) {
    return true;
  }

  // Don't retry client errors (4xx) except specific ones
  if (status >= 400 && status < 500) {
    return status === 408 || status === 429; // Timeout or rate limit
  }

  return false;
}

/**
 * Delay for retry with exponential backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for retry attempt
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelay * Math.pow(2, attempt);
  return Math.min(exponentialDelay, options.maxDelay);
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Don't retry if error is not retryable
      if (!isRetryableError(error)) {
        break;
      }

      // Wait before retry
      const delayMs = calculateDelay(attempt, opts);
      await delay(delayMs);
    }
  }

  throw lastError;
}

import { smartFetch } from './smart-fetch';

/**
 * Fetch with retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await smartFetch(url, options);

      // Throw error for non-ok responses so retry logic can handle them
      // Don't retry 4xx errors (client errors) - they're permanent
      if (!response.ok) {
        const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        // Mark 4xx errors as non-retryable
        if (response.status >= 400 && response.status < 500) {
          error.retryable = false;
        }
        throw error;
      }

      return response;
    },
    retryOptions
  );
}

