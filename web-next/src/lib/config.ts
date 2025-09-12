// web-next/src/lib/config.ts

// Environment detection
const isDevelopment = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
const isStaging = process.env.VERCEL_ENV === "preview";
const isProduction = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";

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
    // Use different Supabase projects for different environments
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    
    // Environment-specific settings
    projectId: isProduction ? "prod" : isStaging ? "staging" : "dev",
    enableBackups: isProduction || isStaging,
  },
  
  // API configuration
  api: {
    cocApiKey: process.env.COC_API_KEY!,
    cocBaseUrl: process.env.COC_BASE_URL || "https://api.clashofclans.com/v1",
    openaiApiKey: process.env.OPENAI_API_KEY!,
  },
  
  // Development settings
  dev: {
    enableDebugLogging: process.env.ENABLE_DEBUG_LOGGING === "true",
    mockApiCalls: process.env.MOCK_API_CALLS === "true",
    useTestData: process.env.USE_TEST_DATA === "true",
  }
} as const;

