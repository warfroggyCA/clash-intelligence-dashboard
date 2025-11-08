/**
 * Error sanitization utilities
 * Prevents exposure of file paths, usernames, and sensitive information in error messages
 */

const isProduction = process.env.NODE_ENV === 'production';
const isVercel = !!process.env.VERCEL;

/**
 * Patterns that might expose file paths or sensitive information
 */
const SENSITIVE_PATTERNS = [
  // File paths (Unix/Mac)
  /\/Users\/[^\/\s]+/g,
  /\/home\/[^\/\s]+/g,
  /\/tmp\/[^\/\s]+/g,
  // File paths (Windows)
  /[A-Z]:\\[^\\\s]+/g,
  /\\Users\\[^\\\s]+/g,
  // Vercel build paths
  /\/vercel\/[^\/\s]+/g,
  /\/tmp\/[^\/\s]+/g,
  // Next.js build paths
  /\.next\/[^\/\s]+/g,
  // Node modules paths
  /node_modules\/[^\/\s]+/g,
  // Source file references
  /web-next\/src\/[^\/\s]+/g,
  // Stack trace file references
  /at\s+[^\s]+\s+\([^)]+\)/g,
  /at\s+[^\s]+:[0-9]+:[0-9]+/g,
  // Common username patterns (case-insensitive)
  /dougfindlay/gi,
  // Email addresses (partial sanitization)
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
];

/**
 * Sanitize error message to remove file paths and sensitive information
 */
export function sanitizeErrorMessage(message: string | undefined | null): string {
  if (!message) {
    return 'An unexpected error occurred';
  }

  let sanitized = message;

  // Remove file paths and sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // Remove stack traces (lines starting with "at" or containing file paths)
  const lines = sanitized.split('\n');
  const cleanedLines = lines.filter(line => {
    const trimmed = line.trim();
    // Remove stack trace lines
    if (trimmed.startsWith('at ') || trimmed.match(/^\w+@/)) {
      return false;
    }
    // Remove lines with file paths
    if (trimmed.includes('/Users/') || trimmed.includes('\\Users\\') || trimmed.includes('/vercel/')) {
      return false;
    }
    return true;
  });
  sanitized = cleanedLines.join('\n').trim();

  // If message was completely sanitized, return generic message
  if (!sanitized || sanitized === '[REDACTED]' || sanitized.length < 3) {
    return 'An unexpected error occurred';
  }

  return sanitized;
}

/**
 * Sanitize error object for display
 */
export function sanitizeError(error: Error | any): {
  message: string;
  name: string;
  stack?: string;
} {
  const name = error?.name || 'Error';
  const message = sanitizeErrorMessage(error?.message);
  
  // Only include stack in development, and sanitize it
  let stack: string | undefined;
  if (!isProduction && error?.stack) {
    stack = sanitizeErrorMessage(error.stack);
  }

  return {
    name,
    message,
    ...(stack && { stack }),
  };
}

/**
 * Sanitize error for API response
 * Removes all sensitive information before sending to client
 */
export function sanitizeErrorForApi(error: Error | any): {
  message: string;
  name?: string;
  status?: number;
} {
  const sanitized = sanitizeError(error);
  
  return {
    message: sanitized.message,
    ...(sanitized.name && sanitized.name !== 'Error' && { name: sanitized.name }),
    ...(error?.status && { status: error.status }),
  };
}

/**
 * Check if an error message contains sensitive information
 */
export function containsSensitiveInfo(message: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
}

