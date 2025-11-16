# Player Tag Onboarding System

**Date:** November 16, 2025  
**Goal:** Implement mandatory player tag selection during onboarding. Users must select their tag(s) from the current clan roster before accessing the dashboard. Multiple tags selected during onboarding are automatically linked as aliases. Display logic updated to always show player tags/names, never emails.

---

## Overview
Enforce mandatory player tag selection during onboarding. Users authenticate via Supabase, then must select their player tag(s) from the current clan roster before accessing the dashboard. Multiple tags selected are automatically linked as aliases. All display logic updated to show player tags/names instead of emails.

## Security Model

**Critical Requirement:** Prevent unauthorized users from claiming leader/coleader player tags.

**Solution:** Lock player tag to invitation. Leader MUST specify the player tag when inviting. User can only confirm the tag matches during onboarding (cannot change it).

**Leader/Coleader Protection:**
- When inviting with leader/coleader role, the specified player tag MUST match an existing leader/coleader role in the clan's current roster
- System validates tag exists and has matching role before allowing invitation
- Additional verification: Require second leader approval for leader role assignments (optional enhancement)

## Database Changes

### 1. Make `player_tag` required in `user_roles`
- **File**: `supabase/migrations/[timestamp]_make_player_tag_required.sql`
- Add NOT NULL constraint to `user_roles.player_tag` (after migration period)
- Add check constraint: `player_tag` must exist in current `members` table for the clan
- Note: This will require a migration strategy for existing users

### 2. Create `user_invitations` table (stores locked tag assignments)
- **File**: `supabase/migrations/[timestamp]_create_user_invitations.sql`
- Fields: `id`, `invited_email`, `invited_by_user_id`, `clan_id`, `assigned_role`, `locked_player_tag` (required), `locked_alias_tags` (JSONB array, optional), `invitation_token` (unique), `status` (pending/accepted/expired), `created_at`, `accepted_at`, `expires_at`
- Stores the player tag(s) locked to the invitation - user cannot change during onboarding
- Token used in invite email link

### 3. Add security constraints to `user_roles`
- **File**: `supabase/migrations/[timestamp]_add_role_security_constraints.sql`
- Add function to validate leader/coleader tag matches current roster role
- Prevent role escalation: if tag is member/elder in roster, cannot assign leader/coleader role
- Only allow leader/coleader role if tag has matching role in current roster

## API Routes

### 3. Create `/api/onboarding/invitation` endpoint
- **File**: `web-next/src/app/api/onboarding/invitation/route.ts`
- Accepts: `{ token: string }` (from invite email link)
- Returns invitation details: `{ clanTag, lockedPlayerTag, lockedAliasTags, role, clanName }`
- Validates token is valid and not expired
- Used by onboarding page to load locked tag assignment

### 4. Create `/api/onboarding/confirm` endpoint
- **File**: `web-next/src/app/api/onboarding/confirm/route.ts`
- Accepts: `{ token: string, confirmed: boolean }`
- Validates invitation token matches authenticated user's email
- If confirmed: Creates `user_roles` entry with locked tag, creates `player_alias_links` for alias tags
- **Security check**: Validates locked tag still exists in current roster and matches assigned role
- For leader/coleader roles: Double-checks tag has matching role in current roster
- Marks invitation as accepted
- Returns success/error

### 5. Update `/api/admin/roles` POST endpoint (invite user)
- **File**: `web-next/src/app/api/admin/roles/route.ts` (POST handler)
- **REQUIRED CHANGE**: `playerTag` is now mandatory (not optional)
- Validates `playerTag` exists in current roster
- **Security**: If role is 'leader' or 'coleader', validates tag has matching role in current roster
- Creates `user_invitations` entry with locked tag
- Generates invitation token
- Sends invite email with token link (Supabase Auth invite + custom onboarding link)
- Returns invitation details

### 6. Update `/api/session` to check for player_tag
- **File**: `web-next/src/app/api/session/route.ts`
- Add `needsOnboarding: boolean` flag if user has roles but no `player_tag`
- Return player tag/name in user object instead of email

### 7. Create `/api/user/player-name` helper
- **File**: `web-next/src/app/api/user/player-name/route.ts`
- Returns player name for a given tag from latest snapshot or members table
- Used for display throughout the app

## Frontend Components

### 8. Create onboarding page
- **File**: `web-next/src/app/onboarding/page.tsx`
- Accepts `?token=...` query parameter from invite email
- Fetches invitation details via `/api/onboarding/invitation`
- **Displays locked player tag** (read-only, cannot change)
- Shows player name from roster for the locked tag
- If alias tags exist, shows them as read-only (cannot add/remove)
- Shows assigned role (read-only)
- "Confirm" button calls `/api/onboarding/confirm`
- Shows error if tag no longer exists in roster or role mismatch
- Redirects to `/app` after successful confirmation
- **Security**: If user tries to access without valid token, redirect to login

### 9. Create `OnboardingGuard` component
- **File**: `web-next/src/components/layout/OnboardingGuard.tsx`
- Checks if user has `player_tag` in their roles
- If missing, redirects to `/onboarding`
- Wraps `AuthGate` in dashboard layout

### 10. Update `AuthGate` to check onboarding status
- **File**: `web-next/src/components/layout/AuthGuard.tsx`
- After session hydration, check if user needs onboarding
- Redirect to `/onboarding` if `needsOnboarding: true`

### 11. Update `auth/callback` to check onboarding
- **File**: `web-next/src/app/auth/callback/page.tsx`
- After successful auth, check if user needs onboarding
- If user has pending invitation token in query params, preserve it
- Redirect to `/onboarding?token=[token]` if invitation exists, otherwise `/onboarding` if needed

### 12. Update dashboard store to track onboarding status
- **File**: `web-next/src/lib/stores/dashboard-store.ts`
- Add `needsOnboarding: boolean` to state
- Set during `hydrateSession` based on session API response
- Add `hasCompletedOnboarding()` selector

## Display Logic Updates

### 13. Update all user display components to show player tag/name
- **Files**: 
  - `web-next/src/components/settings/SettingsContent.tsx` (Active access panel)
  - `web-next/src/components/layout/DashboardLayout.tsx` (user menu)
  - Any other components showing user identity
- Replace email display with player tag/name lookup
- Use `/api/user/player-name` or fetch from roster data
- Fallback to tag if name unavailable (never email)

### 14. Update `PermissionManager` to show player tags
- **File**: `web-next/src/components/settings/PermissionManager.tsx`
- Display player tag/name instead of email in role entries
- Add visual indicator for users without tags (shouldn't exist after onboarding)

### 15. Update `DashboardLayout` user menu
- **File**: `web-next/src/components/layout/DashboardLayout.tsx`
- Show player name/tag instead of email
- Use player name from roster or tag lookup

## Alias Management

### 16. Alias association during onboarding (leader-specified)
- **File**: `web-next/src/app/api/onboarding/confirm/route.ts`
- When invitation has `locked_alias_tags`, create `player_alias_links` entries
- Link all alias tags to the primary locked tag (create pairs: primary-tag1, primary-tag2, etc.)
- Use `linkPlayerTags` utility from `web-next/src/lib/player-aliases.ts`
- **Security**: Validate all alias tags exist in current roster before linking
- Leader can optionally specify known aliases when inviting (e.g., if player has minis)

### 17. Self-service alias requests (post-onboarding)
- **File**: `web-next/src/app/api/user/request-alias/route.ts` (new)
- Allows authenticated users to request additional alias tags be linked to their account
- Accepts: `{ requestedTag: string, reason?: string }`
- Validates requested tag exists in current roster
- Creates `alias_requests` table entry with status 'pending'
- Leader receives notification/see requests in settings panel
- Leader can approve/reject via existing alias management UI

### 18. Create `alias_requests` table
- **File**: `supabase/migrations/[timestamp]_create_alias_requests.sql`
- Fields: `id`, `user_id`, `clan_id`, `requested_tag`, `reason`, `status` (pending/approved/rejected), `created_at`, `reviewed_by`, `reviewed_at`
- Tracks player-initiated alias link requests requiring leader approval

### 19. Update Settings UI for alias requests
- **File**: `web-next/src/components/settings/SettingsContent.tsx`
- Add "Alias Requests" section for leaders
- Show pending requests with player name, requested tag, reason
- Approve/reject buttons that call `/api/admin/aliases/approve`
- After approval, create `player_alias_links` entry

### 20. Add "Request Alias" UI for players
- **File**: `web-next/src/app/player/[tag]/PlayerProfileClient.tsx` or new settings page
- Button: "Link this account to mine" (if viewing another player's profile)
- Or: Settings page with "Add alias tag" form
- Submits to `/api/user/request-alias`
- Shows status: "Request pending leader approval"

### 21. Add alias visibility controls (future enhancement)
- Add `is_public` boolean to `player_alias_links` table
- Default to `false` (private)
- Leaders can toggle visibility in settings

## Access Control Updates

### 18. Enforce player_tag requirement in guards
- **File**: `web-next/src/lib/auth/guards.ts`
- Update `requireRole` to check `player_tag` exists
- Return 403 if user has role but no tag
- **Additional security**: When checking leader/coleader roles, verify tag still has matching role in current roster
- If tag role changed (e.g., demoted), downgrade user role or revoke access

### 19. Sync roster changes to user access
- **File**: `web-next/src/lib/ingestion/persist-roster.ts` or new sync job
- When member departs clan, remove their `user_roles` entry (cascade)
- When member rejoins, restore access if they had a role before

### 22. Update invite email template
- **File**: Supabase email template or custom email service
- Include onboarding link: `https://[domain]/onboarding?token=[invitation_token]`
- Clear message: "You've been invited to join [Clan Name] as [Role]. Click to confirm your player tag."
- Show locked player tag in email for verification

## Testing & Migration

### 23. Create migration script for existing users
- **File**: `scripts/migrate-existing-users-to-onboarding.sql`
- Identify users with roles but no `player_tag`
- Mark them as needing onboarding
- Or: Auto-assign based on email matching (if possible)

### 24. Add onboarding status check to session API
- Ensure `/api/session` returns `needsOnboarding` flag
- Update TypeScript types for session response

## UI/UX Enhancements

### 25. Style onboarding page to match dashboard
- Use same glass card, gradient background, gold/orange buttons
- Show clan name and current member count
- Clear instructions: "Select your player tag(s) from the roster below"

### 26. Add loading states and error handling
- Show spinner while fetching roster
- Display error if tag selection fails
- Handle edge cases (no roster, user already has tag, etc.)

## Files to Create/Modify

**New Files:**
- `supabase/migrations/[timestamp]_make_player_tag_required.sql`
- `supabase/migrations/[timestamp]_create_user_invitations.sql`
- `supabase/migrations/[timestamp]_add_role_security_constraints.sql`
- `supabase/migrations/[timestamp]_create_alias_requests.sql`
- `web-next/src/app/onboarding/page.tsx`
- `web-next/src/app/api/onboarding/invitation/route.ts`
- `web-next/src/app/api/onboarding/confirm/route.ts`
- `web-next/src/app/api/user/player-name/route.ts`
- `web-next/src/app/api/user/request-alias/route.ts`
- `web-next/src/app/api/admin/aliases/approve/route.ts`
- `web-next/src/components/layout/OnboardingGuard.tsx`

**Modified Files:**
- `web-next/src/app/api/session/route.ts`
- `web-next/src/app/auth/callback/page.tsx`
- `web-next/src/components/layout/AuthGuard.tsx`
- `web-next/src/lib/stores/dashboard-store.ts`
- `web-next/src/components/settings/SettingsContent.tsx`
- `web-next/src/components/settings/PermissionManager.tsx`
- `web-next/src/components/layout/DashboardLayout.tsx`
- `web-next/src/lib/auth/guards.ts`
- `web-next/src/app/api/admin/roles/route.ts`

