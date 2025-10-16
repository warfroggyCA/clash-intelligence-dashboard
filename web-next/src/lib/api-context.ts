import { NextRequest, NextResponse } from 'next/server';

export interface ApiContext {
  json: (data: any, init?: ResponseInit) => NextResponse;
  request: NextRequest;
  endpoint: string;
}

export function createApiContext(request: NextRequest, endpoint: string): ApiContext {
  return {
    json: (data: any, init?: ResponseInit) => {
      return NextResponse.json(data, init);
    },
    request,
    endpoint
  };
}
