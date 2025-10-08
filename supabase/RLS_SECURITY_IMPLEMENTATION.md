# Row Level Security (RLS) Implementation

**Date:** January 25, 2025  
**Status:** ✅ **READY TO DEPLOY**  
**Security Level:** HIGH - Blocks all anonymous access

---

## 🚨 **SECURITY ISSUE RESOLVED**

### **Problem:**
17 tables in the `public` schema had RLS disabled, allowing **unrestricted access** to anyone with the PostgREST API URL.

### **Solution:**
Enabled RLS on all tables with a **service role + authenticated** security model.

---

## 🔐 **SECURITY MODEL**

### **Access Levels:**

1. **Service Role (Backend)**
   - ✅ **Full access** (read, write, delete)
   - Used by: Your Next.js API routes with `SUPABASE_SERVICE_ROLE_KEY`
   - Purpose: Backend operations, ingestion, admin tasks

2. **Authenticated Users**
   - ✅ **Read access only**
   - Used by: Your Next.js API routes when called by logged-in users
   - Purpose: Serving data to frontend through your API

3. **Anonymous/Public**
   - ❌ **No access** (completely blocked)
   - Purpose: Prevent unauthorized access

### **Why This Model?**

Your application architecture uses:
- Next.js API routes as the data access layer
- Backend authentication through `user_roles` table
- No direct Supabase queries from the browser

This RLS model ensures:
- ✅ Your backend can fully manage data
- ✅ Your API routes can serve data to authenticated users
- ❌ Direct database access from browser is impossible
- ❌ Anonymous users cannot access any data

---

## 📋 **AFFECTED TABLES**

All 17 tables now have RLS enabled:

1. `smart_insights_payloads` - AI-generated insights
2. `members` - Clan member records
3. `roster_snapshots` - Historical roster data
4. `member_snapshot_stats` - Member statistics per snapshot
5. `war_prep_pins` - War preparation assignments
6. `war_attacks` - War attack records
7. `wars` - War metadata
8. `war_defenses` - War defense records
9. `capital_raid_seasons` - Capital raid season data
10. `capital_attacks` - Capital raid attack records
11. `member_tenure_ledger` - Member tenure tracking
12. `member_notes` - Notes about members
13. `alerts` - Alert notifications
14. `tasks` - Task management
15. `metrics` - Performance metrics
16. `clan_settings` - Clan configuration
17. `ingest_logs` - Data ingestion logs

---

## 🚀 **DEPLOYMENT INSTRUCTIONS**

### **Option 1: Deploy via Supabase MCP (Recommended)**
```bash
# The migration file is ready at:
# supabase/migrations/20250125_enable_rls_all_tables.sql

# Use the Supabase MCP tool to apply the migration
```

### **Option 2: Deploy via Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Open the migration file: `supabase/migrations/20250125_enable_rls_all_tables.sql`
3. Copy and paste the SQL into the SQL Editor
4. Click "Run" to execute

### **Option 3: Deploy via Supabase CLI**
```bash
# From the project root
supabase db push
```

---

## ✅ **VERIFICATION**

### **After Deployment, Verify RLS is Enabled:**

Run this query in Supabase SQL Editor:
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**Expected:** All tables should show `rowsecurity = true`

### **Verify Policies Exist:**

Run this query:
```sql
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

**Expected:** Each table should have 2 policies:
- "Service role full access" (FOR ALL)
- "Authenticated read access" (FOR SELECT)

---

## 🧪 **TESTING**

### **Test 1: Service Role Access (Should Work)**
```typescript
// In your Next.js API route
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role key
);

// Should work - full access
const { data, error } = await supabase
  .from('roster_snapshots')
  .select('*');
```

### **Test 2: Anonymous Access (Should Fail)**
```typescript
// In browser console (don't actually do this in production)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_ANON_KEY' // Anon key
);

// Should fail with permission error
const { data, error } = await supabase
  .from('roster_snapshots')
  .select('*');

console.log(error); // Expected: "permission denied for table roster_snapshots"
```

### **Test 3: Authenticated Read (Should Work)**
```typescript
// In your Next.js API route with authenticated user context
const { data, error } = await supabase
  .from('roster_snapshots')
  .select('*'); // Should work - read access
```

---

## 🔧 **TROUBLESHOOTING**

### **Issue: API Routes Return "permission denied"**

**Cause:** API route is not using service role key

**Solution:** Ensure your Supabase client in API routes uses `SUPABASE_SERVICE_ROLE_KEY`:
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ← Use service role key
);
```

### **Issue: Write Operations Fail**

**Cause:** Client is using authenticated role instead of service role

**Solution:** Write operations should only happen in API routes using service role key

### **Issue: Migration Fails**

**Cause:** Policies with duplicate names already exist

**Solution:** Drop existing policies first:
```sql
-- Run this before the migration if needed
DROP POLICY IF EXISTS "Service role full access" ON public.smart_insights_payloads;
DROP POLICY IF EXISTS "Authenticated read access" ON public.smart_insights_payloads;
-- Repeat for all tables
```

---

## 📊 **SECURITY IMPACT**

### **Before RLS:**
- ❌ Anyone with API URL could read all data
- ❌ Anyone with API URL could modify all data
- ❌ No authentication required
- ❌ Complete database exposure

### **After RLS:**
- ✅ Only backend (service role) has full access
- ✅ Only authenticated users can read data
- ✅ Anonymous users completely blocked
- ✅ Database properly secured

---

## 🎯 **FUTURE ENHANCEMENTS**

### **Clan-Based RLS (Optional)**
If you want users to only see data for their clan:

```sql
-- Example: Clan-based read access
CREATE POLICY "Users can only see their clan data" 
ON public.roster_snapshots 
FOR SELECT 
USING (
  clan_tag IN (
    SELECT clan_tag 
    FROM user_roles 
    WHERE user_id = auth.uid()
  )
);
```

### **Role-Based Write Access (Optional)**
If you want leaders/co-leaders to write data directly:

```sql
-- Example: Leader can write
CREATE POLICY "Leaders can write" 
ON public.member_notes 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('leader', 'coleader')
  )
);
```

---

## 📝 **COMMIT MESSAGE**

```
🔐 SECURITY: Enable Row Level Security on all public tables

- Enabled RLS on 17 tables to prevent unauthorized access
- Created policies: Service role full access, Authenticated read access
- Blocks all anonymous/public access to database
- Resolves Supabase security advisory: rls_disabled_in_public
- Security model: Backend (service role) + Authenticated users only
```

---

**Last Updated:** January 25, 2025  
**Status:** ✅ **READY TO DEPLOY** - Migration file created, awaiting deployment

---

## 🔗 **REFERENCES**

- **Supabase RLS Docs:** https://supabase.com/docs/guides/auth/row-level-security
- **Security Advisory:** https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public
- **Migration File:** `supabase/migrations/20250125_enable_rls_all_tables.sql`

