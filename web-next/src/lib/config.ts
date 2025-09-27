// web-next/src/lib/config.ts
import { z } from 'zod';

// Environment detection
const isDevelopment = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
const isStaging = process.env.VERCEL_ENV === "preview";
const isProduction = process.env.NODE_ENV === "production" && (process.env.VERCEL_ENV === "production" || !process.env.VERCEL_ENV);

// Fail-fast env validation in production. In development, warn but do not crash.
const REQUIRED_IN_PROD = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'COC_API_TOKEN',
];

function validateEnv() {
  // Check if we're in a browser environment where env vars might not be available yet
  if (typeof window !== 'undefined') {
    // In browser, skip validation as env vars are injected at build time
    return;
  }
  
  if (!isProduction) {
    const missing = REQUIRED_IN_PROD.filter((k) => !process.env[k]);
    if (missing.length) {
      console.warn(`[config] Missing env vars (development): ${missing.join(', ')}`);
    }
    return;
  }
  const missing = REQUIRED_IN_PROD.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`[config] Missing required env vars in production: ${missing.join(', ')}`);
  }
}

validateEnv();

// Data source configuration
const useLocalData = isDevelopment && process.env.USE_LOCAL_DATA !== "false";
const useSupabase = !useLocalData;

export const cfg = {
  // Data storage paths
  dataRoot: process.env.NODE_ENV === "production" ? "/tmp/data" : "../out",
  fallbackDataRoot: process.env.NODE_ENV === "production" ? "/tmp/fallback" : "../data",
  
  // Environment settings
  isDevelopment,
  isStaging,
  isProduction,
  
  // Data source settings
  useLocalData,
  useSupabase,
  
  // Clan configuration
  homeClanTag: "#2PR8R8V8P",
  enableCleanDownload: false,
  
  // Database configuration
  database: {
    // Different Supabase projects by environment
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    
    // Environment-specific settings
    projectId: isProduction ? "prod" : isStaging ? "staging" : "dev",
    enableBackups: isProduction || isStaging,
  },
  
  // API configuration
  api: {
    cocApiKey: process.env.COC_API_KEY || process.env.COC_API_TOKEN || "",
    cocBaseUrl: process.env.COC_BASE_URL || "https://api.clashofclans.com/v1",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
  },
  
  // Development settings
  dev: {
    enableDebugLogging: process.env.ENABLE_DEBUG_LOGGING === "true",
    mockApiCalls: process.env.MOCK_API_CALLS === "true",
    useTestData: process.env.USE_TEST_DATA === "true",
  },

  ingestion: {
    maxConcurrentJobs: Number(process.env.INGESTION_MAX_CONCURRENT || 1),
  }
} as const;
