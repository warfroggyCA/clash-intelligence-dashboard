"use client";

import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export default class RootErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, message: error?.message || 'Unexpected error' };
  }

  componentDidCatch(error: any, info: any) {
    // Log to console for quick diagnosis
    // eslint-disable-next-line no-console
    console.error('[Dashboard ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-2xl border border-rose-400/40 bg-rose-500/10 p-5 text-rose-100">
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm opacity-90">{this.state.message}</p>
            <p className="mt-3 text-xs opacity-70">Open the console for details and stack trace.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

