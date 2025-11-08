"use client";

import { SWRConfig } from 'swr';
import { defaultSWRConfig } from '@/lib/api/swr-config';

/**
 * SWR Provider Component
 * Wraps the app with SWR configuration
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={defaultSWRConfig}>
      {children}
    </SWRConfig>
  );
}

