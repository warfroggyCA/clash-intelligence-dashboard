#!/usr/bin/env node

// Environment checker script
const requiredEnvVars = [
  'COC_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY'
];

const optionalEnvVars = [
  'DEFAULT_CLAN_TAG',
  'DEV_MODE',
  'ENABLE_DEBUG_LOGGING'
];

console.log('🔍 Checking environment variables...\n');

let hasErrors = false;

// Check required variables
console.log('✅ Required variables:');
requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`  ✓ ${varName}: ${process.env[varName].substring(0, 10)}...`);
  } else {
    console.log(`  ✗ ${varName}: MISSING`);
    hasErrors = true;
  }
});

// Check optional variables
console.log('\n📋 Optional variables:');
optionalEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`  ✓ ${varName}: ${process.env[varName]}`);
  } else {
    console.log(`  - ${varName}: not set (using default)`);
  }
});

// Environment info
console.log('\n🌍 Environment Info:');
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`  VERCEL_ENV: ${process.env.VERCEL_ENV || 'not set'}`);

if (hasErrors) {
  console.log('\n❌ Missing required environment variables!');
  console.log('Please check your .env.local file or Vercel environment settings.');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set!');
  process.exit(0);
}
