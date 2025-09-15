import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { createRequestLogger } from '@/lib/logger';

/**
 * Create a per-request API context with logger and a JSON responder that
 * injects `requestId` and `x-request-id` header consistently.
 */
export function createApiContext(req: Request, route: string) {
  const logger = createRequestLogger(req, { route });

  function json<T = any>(body: ApiResponse<T>, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set('x-request-id', logger.requestId);
    const payload: ApiResponse<T> = { ...body, requestId: logger.requestId };
    return NextResponse.json<ApiResponse<T>>(payload, { ...init, headers });
  }

  return { logger, json };
}

