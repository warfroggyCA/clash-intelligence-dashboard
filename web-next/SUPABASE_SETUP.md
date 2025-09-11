# Supabase Setup Guide for Clash Intelligence

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - Name: `clash-intelligence`
   - Database Password: (generate a strong password)
   - Region: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be ready (2-3 minutes)

## 2. Set Up Database Schema

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Copy and paste the contents of `supabase-schema.sql` into the editor
4. Click "Run" to execute the schema

This will create:
- `snapshots` table for storing snapshot metadata
- `tenure_ledger` table for tenure data
- Storage buckets for files
- Proper indexes and security policies

## 3. Configure Environment Variables

1. In your Supabase project, go to "Settings" → "API"
2. Copy the following values:
   - Project URL
   - Anon public key

3. In your Vercel project:
   - Go to "Settings" → "Environment Variables"
   - Add these variables:
     - `NEXT_PUBLIC_SUPABASE_URL` = your project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key

## 4. Deploy to Vercel

```bash
vercel --prod
```

## 5. Test the Setup

1. Run the upload script:
   ```bash
   node upload-data.js
   ```

2. Check the debug endpoint:
   ```bash
   curl "https://your-app.vercel.app/api/debug/data"
   ```

3. Test snapshots list:
   ```bash
   curl "https://your-app.vercel.app/api/snapshots/list?clanTag=%232PR8R8V8P"
   ```

## Benefits of Supabase Solution

✅ **Persistent Storage** - Data survives between deployments
✅ **Structured Queries** - SQL queries for complex filtering
✅ **File Storage** - JSON files stored in Supabase Storage
✅ **Real-time** - Can add live updates later
✅ **Scalable** - Handles large amounts of data
✅ **Free Tier** - 500MB database + 1GB file storage
✅ **Better Performance** - Indexed queries are fast

## Database Schema

### snapshots table
- `id` - Primary key
- `clan_tag` - Clan identifier (e.g., "2pr8r8v8p")
- `filename` - Original filename
- `date` - Snapshot date
- `member_count` - Number of members
- `clan_name` - Clan name
- `timestamp` - When snapshot was taken
- `file_url` - URL to the JSON file in storage
- `created_at` - When record was created

### tenure_ledger table
- `id` - Primary key
- `file_url` - URL to the tenure ledger file
- `size` - File size in bytes
- `created_at` - When record was created

## Troubleshooting

If you get authentication errors:
1. Check that environment variables are set correctly
2. Ensure the anon key has the right permissions
3. Verify the project URL is correct

If uploads fail:
1. Check Supabase logs in the dashboard
2. Verify storage buckets exist
3. Check file size limits
