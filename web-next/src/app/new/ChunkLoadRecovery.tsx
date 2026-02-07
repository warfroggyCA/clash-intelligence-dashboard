"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const RELOAD_KEY_PREFIX = 'new-route-chunk-reload';

function looksLikeChunkLoadError(reason: unknown): boolean {
  if (!reason) return false;
  const message =
    typeof reason === 'string'
      ? reason
      : reason instanceof Error
        ? reason.message
        : String(reason);

  return /ChunkLoadError|Loading chunk [\w/%.-]+ failed|Failed to fetch dynamically imported module/i.test(message);
}

export default function ChunkLoadRecovery() {
  const pathname = usePathname();

  useEffect(() => {
    const currentPath = pathname || window.location.pathname || '/new';
    const storageKey = `${RELOAD_KEY_PREFIX}:${currentPath}`;

    const reloadOnce = () => {
      try {
        if (window.sessionStorage.getItem(storageKey) === '1') return;
        window.sessionStorage.setItem(storageKey, '1');
      } catch {
        // Ignore sessionStorage failures and continue with reload attempt.
      }
      window.location.reload();
    };

    const onWindowError = (event: ErrorEvent) => {
      if (looksLikeChunkLoadError(event.error || event.message)) {
        reloadOnce();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (looksLikeChunkLoadError(event.reason)) {
        reloadOnce();
      }
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [pathname]);

  return null;
}
