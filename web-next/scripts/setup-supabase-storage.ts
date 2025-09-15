#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getSupabaseAdminClient } from '../src/lib/supabase-admin';

const BUCKETS = [
  {
    name: 'snapshots',
    description: 'Daily clan snapshots',
    public: true,
  },
  {
    name: 'changes', 
    description: 'Change summaries and logs',
    public: true,
  },
  {
    name: 'tenure',
    description: 'Tenure ledger data',
    public: false,
  },
  {
    name: 'departures',
    description: 'Departure records',
    public: false,
  },
  {
    name: 'player-db',
    description: 'Player database and resolution data',
    public: false,
  },
];

async function setupBuckets() {
  console.log('🚀 Setting up Supabase storage buckets...');
  
  const supabase = getSupabaseAdminClient();
  
  for (const bucket of BUCKETS) {
    try {
      // Check if bucket exists
      const { data: existing } = await supabase.storage.getBucket(bucket.name);
      
      if (existing) {
        console.log(`✅ Bucket '${bucket.name}' already exists`);
      } else {
        // Create bucket
        const { data, error } = await supabase.storage.createBucket(bucket.name, {
          public: bucket.public,
        });
        
        if (error) {
          console.error(`❌ Failed to create bucket '${bucket.name}':`, error.message);
          continue;
        }
        
        console.log(`✅ Created bucket '${bucket.name}' (public: ${bucket.public})`);
      }
      
      // Set up access policies
      await setupBucketPolicies(bucket);
      
    } catch (error) {
      console.error(`❌ Error with bucket '${bucket.name}':`, error);
    }
  }
  
  console.log('🎉 Supabase storage setup complete!');
}

async function setupBucketPolicies(bucket: typeof BUCKETS[0]) {
  const supabase = getSupabaseAdminClient();
  
  try {
    if (bucket.public) {
      // Public read access for snapshots and changes
      const { error: selectError } = await supabase.rpc('create_policy_if_not_exists', {
        policy_name: `${bucket.name}_public_read`,
        table_name: 'objects',
        policy_definition: `bucket_id = '${bucket.name}'`,
        policy_check: 'bucket_id = bucket_id',
        policy_roles: 'public',
        policy_cmd: 'SELECT'
      });
      
      if (selectError) {
        console.log(`⚠️  Could not set public read policy for '${bucket.name}' (may already exist)`);
      } else {
        console.log(`✅ Set public read policy for '${bucket.name}'`);
      }
    } else {
      // Service role only access for private buckets
      const { error: serviceError } = await supabase.rpc('create_policy_if_not_exists', {
        policy_name: `${bucket.name}_service_only`,
        table_name: 'objects',
        policy_definition: `bucket_id = '${bucket.name}' AND auth.role() = 'service_role'`,
        policy_check: 'bucket_id = bucket_id AND auth.role() = service_role',
        policy_roles: 'service_role',
        policy_cmd: 'ALL'
      });
      
      if (serviceError) {
        console.log(`⚠️  Could not set service role policy for '${bucket.name}' (may already exist)`);
      } else {
        console.log(`✅ Set service role policy for '${bucket.name}'`);
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not set policies for '${bucket.name}' (this is normal if policies already exist)`);
  }
}

// Create the helper function if it doesn't exist
async function createHelperFunction() {
  const supabase = getSupabaseAdminClient();
  
  const { error } = await supabase.rpc('exec', {
    sql: `
      CREATE OR REPLACE FUNCTION create_policy_if_not_exists(
        policy_name text,
        table_name text,
        policy_definition text,
        policy_check text,
        policy_roles text,
        policy_cmd text
      ) RETURNS void AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE policyname = policy_name 
          AND tablename = table_name
        ) THEN
          EXECUTE format('CREATE POLICY %I ON %I FOR %s TO %s USING (%s) WITH CHECK (%s)',
            policy_name, table_name, policy_cmd, policy_roles, policy_definition, policy_check
          );
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `
  });
  
  if (error) {
    console.log('⚠️  Could not create helper function (may already exist)');
  } else {
    console.log('✅ Created helper function for policy management');
  }
}

async function main() {
  try {
    await createHelperFunction();
    await setupBuckets();
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

main();
