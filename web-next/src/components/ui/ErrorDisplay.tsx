import React from 'react';
import { Button } from './Button';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeErrorMessage } from '@/lib/security/error-sanitizer';

export type ErrorType = 'network' | 'server' | 'notFound' | 'permission' | 'unknown';

interface ErrorDisplayProps {
  /**
   * Error message to display
   */
  message: string;
  /**
   * Type of error for appropriate messaging
   */
  type?: ErrorType;
  /**
   * Title for the error (defaults based on type)
   */
  title?: string;
  /**
   * Callback for retry action
   */
  onRetry?: () => void;
  /**
   * Callback for go back action
   */
  onGoBack?: () => void;
  /**
   * Callback for go home action
   */
  onGoHome?: () => void;
  /**
   * Show retry button (default: true if onRetry provided)
   */
  showRetry?: boolean;
  /**
   * Show back button (default: true if onGoBack provided)
   */
  showBack?: boolean;
  /**
   * Show home button
   */
  showHome?: boolean;
  /**
   * Additional className
   */
  className?: string;
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * User-friendly error display component
 * Provides consistent error UI across the application
 */
export function ErrorDisplay({
  message,
  type = 'unknown',
  title,
  onRetry,
  onGoBack,
  onGoHome,
  showRetry = !!onRetry,
  showBack = !!onGoBack,
  showHome = !!onGoHome,
  className,
  size = 'md',
}: ErrorDisplayProps) {
  const getDefaultTitle = () => {
    switch (type) {
      case 'network':
        return 'Connection Problem';
      case 'server':
        return 'Server Error';
      case 'notFound':
        return 'Not Found';
      case 'permission':
        return 'Access Denied';
      default:
        return 'Something Went Wrong';
    }
  };

  const isTechnicalMessage = (msg: string): boolean => {
    // Check if message contains technical details that users shouldn't see
    return (
      msg.includes('HTTP') ||
      msg.includes('status') ||
      msg.includes('500') ||
      msg.includes('404') ||
      msg.includes('403') ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('TypeError') ||
      msg.includes('Error:')
    );
  };

  const getDefaultMessage = () => {
    // First, sanitize the message to remove any file paths or sensitive info
    const sanitizedMessage = sanitizeErrorMessage(message);
    
    // If message is provided but is technical, use friendly default instead
    if (sanitizedMessage && sanitizedMessage !== 'An unexpected error occurred' && !isTechnicalMessage(sanitizedMessage)) {
      return sanitizedMessage;
    }
    
    // Use user-friendly defaults based on error type
    switch (type) {
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      case 'server':
        return 'The server encountered an error. Please try again in a moment.';
      case 'notFound':
        return 'The requested resource could not be found.';
      case 'permission':
        return 'You don\'t have permission to access this resource.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  const displayTitle = title || getDefaultTitle();
  const displayMessage = getDefaultMessage();

  const sizeClasses = {
    sm: 'px-4 py-3 text-sm',
    md: 'px-6 py-4',
    lg: 'px-8 py-6 text-lg',
  };

  return (
    <div
      className={cn(
        'flex min-h-[60vh] items-center justify-center p-6',
        className
      )}
    >
      <div
        className={cn(
          'w-full max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center shadow-lg',
          sizeClasses[size]
        )}
      >
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-red-500/20 p-3">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </div>

        <h2 className="mb-2 text-xl font-semibold text-red-100">
          {displayTitle}
        </h2>

        <p className="mb-6 text-sm text-red-200/80">
          {displayMessage}
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {showRetry && onRetry && (
            <Button
              variant="primary"
              onClick={onRetry}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}

          {showBack && onGoBack && (
            <Button
              variant="secondary"
              onClick={onGoBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          )}

          {showHome && onGoHome && (
            <Button
              variant="ghost"
              onClick={onGoHome}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to categorize errors by type
 */
export function categorizeError(error: any): ErrorType {
  if (!error) return 'unknown';

  // Network errors
  if (
    error.message?.includes('fetch') ||
    error.message?.includes('network') ||
    error.message?.includes('Failed to fetch') ||
    error.code === 'NETWORK_ERROR' ||
    error.name === 'NetworkError'
  ) {
    return 'network';
  }

  // Not found errors
  if (
    error.status === 404 ||
    error.message?.includes('not found') ||
    error.message?.includes('404')
  ) {
    return 'notFound';
  }

  // Permission errors
  if (
    error.status === 403 ||
    error.status === 401 ||
    error.message?.includes('permission') ||
    error.message?.includes('unauthorized') ||
    error.message?.includes('forbidden')
  ) {
    return 'permission';
  }

  // Server errors
  if (
    error.status >= 500 ||
    error.status === 503 ||
    error.status === 502 ||
    error.message?.includes('server') ||
    error.message?.includes('500')
  ) {
    return 'server';
  }

  return 'unknown';
}

