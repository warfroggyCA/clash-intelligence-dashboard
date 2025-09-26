# Authentication & Role Architecture

## Goals

- Secure API endpoints behind Supabase Auth.
- Map each Supabase user to clan-specific roles stored in `user_roles`.
- Replace local role pickers with real login-based access control.
- Provide the UI with the current user profile + permissions to gate tabs/actions.

## Data Model

Tables (already provisioned in Sprint 0):

- `user_roles`
  - `user_id` references `auth.users`.
  - `clan_id` references `clans`.
  - `player_tag` optional linkage to in-game identity.
  - `role` (`leader`, `coleader`, `elder`, `member`, `viewer`, ...).
  - `created_at` timestamp.

Support tables (future): `users` for profile metadata, invitation tokens, etc.

## Supabase Auth Flow

1. Frontend signs the user in via Supabase Auth (email magic link, OAuth, etc.).
2. The session token is sent to the Next.js server (via cookies).
3. Server-side handlers call Supabase Auth Admin API using the service role to validate the session and look up `user_roles`.

## API Protection

- Utility: `getAuthenticatedRequest(req)` returns `{ user, roles }` or throws.
- Example usage in API route:
  ```ts
  const { user, roles } = await requireRole(req, 'leader');
  ```
- Fallback: maintain `ADMIN_API_KEY` while migrating existing automations.

## UI Integration

- `DashboardLayout` fetches `/api/session` (new endpoint) to get `{ user, clans, roles }`.
- Zustand store holds `currentUser`, `currentRole`, and ensures the active tab list respects permissions.
- Leadership-only components check `canManageClan`, `canRunIngestion`, etc.

## Next Steps (Sprint 2)

1. Implement server helpers: `getSupabaseSession`, `requireRole`.
2. Add `/api/session` route returning the current user + active clan roles.
3. Wrap admin endpoints (`/api/admin/run-ingestion`, `/api/cron/...`) with `requireRole`.
4. Wire Supabase Auth client in the Next.js app and remove the manual role picker.
5. Sync `user_roles` on each roster ingest so in-game roles (leader/co-leader/elder/member) automatically update access levels; demoted/booted members fall back to `viewer`.
6. Update UI to hide tabs for unauthorized roles, show role badges, and surface login/logout controls.
7. Record all role-based decisions in logs for auditability.
