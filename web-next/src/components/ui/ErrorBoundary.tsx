"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorDisplay, categorizeError } from './ErrorDisplay';
import { sanitizeError } from '@/lib/security/error-sanitizer';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Enhanced Error Boundary with user-friendly error display
 * Catches React component errors and displays helpful messages
 * Sanitizes error messages to prevent path exposure
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log full error for debugging (server-side only, not exposed to users)
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Call optional error handler (e.g., for Sentry)
    // Note: error handler receives full error, but we sanitize for display
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = '/app';
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Sanitize error message before displaying to user
      const sanitized = sanitizeError(this.state.error);
      const errorType = categorizeError(this.state.error);

      return (
        <ErrorDisplay
          message={sanitized.message}
          type={errorType}
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}
