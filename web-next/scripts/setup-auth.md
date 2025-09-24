# Supabase Authentication Setup Guide

This guide walks you through setting up authentication for the Clash Intelligence Dashboard.

## Prerequisites

- Supabase project created and configured
- Environment variables set in Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Step 1: Run Database Setup

1. Go to your **Supabase Dashboard** → **SQL Editor**
2. Run the `setup-auth-tables.sql` script:
   ```sql
   -- Copy and paste the contents of web-next/scripts/setup-auth-tables.sql
   ```

This creates:
- `clans` table for clan information
- `user_roles` table for user permissions
- Row Level Security (RLS) policies
- Helper function for creating user roles

## Step 2: Configure Authentication Settings

1. Go to **Authentication** → **Settings**
2. Configure the following:

### Email Authentication
- ✅ Enable **Email** provider
- ✅ Enable **Confirm email** (recommended)
- ✅ Enable **Magic Link** (recommended for easy login)

### URL Configuration
- **Site URL**: `https://clash-intelligence-dashboard-new.vercel.app`
- **Redirect URLs**: 
  - `https://clash-intelligence-dashboard-new.vercel.app/auth/callback`
  - `https://clash-intelligence-dashboard-new.vercel.app/dashboard`

### Additional Settings
- **JWT expiry**: 3600 (1 hour) - adjust as needed
- **Refresh token rotation**: Enabled (recommended)

## Step 3: Create Admin Users

1. Go to **Authentication** → **Users**
2. Click **Invite User**
3. Enter your admin email address
4. The user will receive an invitation email
5. Repeat for any co-leaders or elders

## Step 4: Seed User Roles

1. After users have accepted their invitations and created accounts:
2. Go to **SQL Editor**
3. Update the `seed-admin-users.sql` script with your actual admin emails
4. Run the script to assign roles:

```sql
-- Replace 'admin@yourdomain.com' with your actual admin email
SELECT create_user_role(
  'admin@yourdomain.com',  -- Your admin email
  '#2PR8R8V8P',           -- Your clan tag
  'leader',               -- Role: leader, coleader, elder, member, viewer
  NULL                    -- Player tag (optional)
);
```

## Step 5: Test Authentication

1. Visit your dashboard: `https://clash-intelligence-dashboard-new.vercel.app`
2. Click **Sign In** (should redirect to Supabase Auth)
3. Use Magic Link or email/password to sign in
4. Verify you can access leadership tools

## Role Hierarchy

- **leader**: Full access to all features
- **coleader**: Most features except some admin settings
- **elder**: Basic leadership tools
- **member**: Limited access to clan data
- **viewer**: Read-only access

## Troubleshooting

### "Sign In Required" but user should have access
- Check that the user exists in `auth.users`
- Verify the user has a role in `user_roles` table
- Check that the clan tag matches exactly (including #)

### Magic Link not working
- Verify redirect URLs are correctly configured
- Check that Site URL matches your domain exactly

### Database errors
- Ensure RLS policies are correctly set up
- Check that the `clans` table has your clan data
- Verify foreign key constraints

## Security Notes

- User roles are stored in the database, not in JWT tokens
- RLS policies ensure users can only see their own roles
- The `create_user_role` function is security definer for admin use
- Consider regular audits of user roles and permissions
