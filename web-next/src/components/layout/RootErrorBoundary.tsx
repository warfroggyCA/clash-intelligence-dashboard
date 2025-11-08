"use client";

import React from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

type Props = { children: React.ReactNode };

/**
 * Root-level error boundary for the entire application
 * Uses the enhanced ErrorBoundary component
 */
export default class RootErrorBoundary extends React.Component<Props> {
  render() {
    return (
      <ErrorBoundary
        onError={(error, errorInfo) => {
          // Log to console for debugging
          console.error('[RootErrorBoundary] Caught error:', error, errorInfo);
          
          // TODO: Send to error tracking service (e.g., Sentry)
          // if (typeof window !== 'undefined' && window.Sentry) {
          //   window.Sentry.captureException(error, { contexts: { react: errorInfo } });
          // }
        }}
      >
        {this.props.children}
      </ErrorBoundary>
    );
  }
}

