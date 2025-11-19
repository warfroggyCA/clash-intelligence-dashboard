# In-Game Chat Verification Registration System

**Created:** November 17, 2025  
**Status:** Planning Phase

## Overview
Simple self-service registration flow: players visit clan subdomain /register, enter player tag, get verification code to post in game chat, leader authorizes from dashboard. No Discord bot, no email, no complex token flows.

## Phase 1: Database Schema

### 1.1 Create `pending_registrations` table
- **File**: `supabase/migrations/YYYYMMDD_create_pending_registrations.sql`
- **Schema**:
  - `id` (uuid, primary key)
  - `clan_tag` (text, required, references clans.tag)
  - `player_tag` (text, required, normalized)
  - `verification_code` (text, required, unique, indexed) - e.g., "PURPLE42" or "CLASH-7X9K"
  - `status` (text: 'pending', 'approved', 'rejected', 'expired')
  - `expires_at` (timestamptz, default now() + 24 hours)
  - `created_at`, `updated_at` (timestamptz)
  - `approved_by_user_id` (uuid, nullable, references auth.users)
  - `approved_at` (timestamptz, nullable)
- **Indexes**: verification_code (unique), clan_tag + status, player_tag + clan_tag, expires_at
- **RLS**: Leaders can view/update registrations for their clans; users can view their own pending registrations

## Phase 2: Registration Page

### 2.1 Create `/register` page
- **File**: `web-next/src/app/register/page.tsx`
- **Logic**:
  - Auto-detect clan from subdomain (use existing `getActiveClanConfig()`)
  - Show simple form: "Enter your player tag"
  - On submit: validate tag format, generate verification code, save to `pending_registrations`
  - Display: "Post this code in your clan chat: [CODE]"
  - Show status: "Waiting for leader approval..."
- **File**: `web-next/src/app/register/RegisterClient.tsx`
- **Client component**: Form handling, tag validation, code display

### 2.2 Create registration API endpoint
- **File**: `web-next/src/app/api/register/route.ts`
- **POST /api/register**:
  - Accept: `{ playerTag: string }`
  - Auto-detect clan from subdomain (header or config)
  - Validate player tag format
  - Generate unique verification code (6-8 alphanumeric, readable)
  - Check if player tag exists in current clan roster (query `canonical_member_snapshots`)
  - If not in roster: return error "You must be in the clan to register"
  - If in roster: Create `pending_registrations` record
  - Return: `{ success: true, verificationCode: "PURPLE42" }`
- **GET /api/register/status?code=XXX**:
  - Check registration status by verification code
  - Return: `{ status: 'pending'|'approved'|'rejected', playerTag, clanTag }`

### 2.3 Verification code generator
- **File**: `web-next/src/lib/registration/code-generator.ts`
- **Function**: `generateVerificationCode()` - Returns readable code (e.g., "PURPLE42", "CLASH-7X9K")
- **Format**: Adjective + Number, or CLASH-XXXX
- **Uniqueness**: Check against existing codes in database
- **Length**: 6-10 characters, easy to type in game chat

## Phase 3: Leader Authorization Dashboard

### 3.1 Create pending registrations component
- **File**: `web-next/src/components/leadership/PendingRegistrations.tsx`
- **Features**:
  - List all pending registrations for clan
  - Show: player tag, verification code, time submitted, expiration
  - Actions: "Approve" button, "Reject" button
  - Filter: Show only pending, or all (pending/approved/rejected)
- **API**: `GET /api/register/pending?clanTag=XXX` (leadership only)

### 3.2 Create approval/rejection API endpoints
- **File**: `web-next/src/app/api/register/approve/route.ts`
- **POST /api/register/approve**:
  - Accept: `{ registrationId: uuid }`
  - Require leadership role
  - Update registration status to 'approved'
  - Create Supabase auth user (if doesn't exist)
  - Create `user_roles` record linking user to clan with player tag
  - Return success
- **File**: `web-next/src/app/api/register/reject/route.ts`
- **POST /api/register/reject**:
  - Accept: `{ registrationId: uuid, reason?: string }`
  - Require leadership role
  - Update registration status to 'rejected'
  - Return success

### 3.3 Add to Leadership Dashboard
- **File**: `web-next/src/components/leadership/LeadershipDashboard.tsx`
- **Add**: PendingRegistrations component to "Management" tab
- **Show**: Count badge if pending registrations exist

## Phase 4: User Account Creation

### 4.1 Auto-create Supabase user on approval
- **File**: `web-next/src/app/api/register/approve/route.ts`
- **Logic**:
  - Generate unique email: `{playerTag}@clashintelligence.local` (or use player tag as identifier)
  - Create Supabase auth user via admin API
  - Generate temporary password or magic link
  - Create `user_roles` record with player_tag
  - Send welcome message (optional: email or in-app notification)

### 4.2 Handle existing users
- **Check**: If user_roles already exists for player_tag + clan, update instead of create
- **Prevent duplicates**: Check before creating new registration

## Phase 5: Expiration & Cleanup

### 5.1 Expire old registrations
- **File**: `web-next/src/app/api/register/cleanup/route.ts` (cron job)
- **Logic**: Mark registrations as 'expired' if `expires_at < now()` and status is 'pending'
- **Schedule**: Run daily via Vercel cron or GitHub Actions

### 5.2 Show expiration in UI
- **File**: `web-next/src/components/leadership/PendingRegistrations.tsx`
- **Display**: "Expires in X hours" or "Expired" badge
- **Auto-refresh**: Poll for status updates every 30 seconds

## Phase 6: Security & Validation

### 6.1 Player tag validation
- **File**: `web-next/src/lib/registration/validate-player.ts`
- **Function**: `validatePlayerInClan(playerTag, clanTag)`
  - Query `canonical_member_snapshots` for recent membership (last 7 days)
  - Return boolean + member data if found
  - Reject registration if player not in clan

### 6.2 Rate limiting
- **File**: `web-next/src/app/api/register/route.ts`
- **Add**: Rate limit per IP: max 3 registration attempts per hour
- **Add**: Rate limit per player tag: max 1 pending registration at a time

### 6.3 Duplicate prevention
- **Check**: Before creating registration, check if:
  - Player tag already has approved `user_roles` for this clan
  - Player tag has pending registration (not expired)
  - Return appropriate error message

## Phase 7: User Experience Enhancements

### 7.1 Registration status page
- **File**: `web-next/src/app/register/status/page.tsx`
- **Query param**: `?code=XXX`
- **Display**: Registration status, next steps, link to login if approved

### 7.2 Copy code button
- **File**: `web-next/src/app/register/RegisterClient.tsx`
- **Add**: "Copy code" button for easy copy-paste to game chat

### 7.3 Instructions on registration page
- **Display**: Step-by-step instructions:
  1. Enter your player tag
  2. Copy the verification code
  3. Post it in your clan chat
  4. Wait for leader approval

## Phase 8: Testing & Documentation

### 8.1 Unit tests
- **File**: `web-next/src/lib/registration/__tests__/code-generator.test.ts`
- **File**: `web-next/src/lib/registration/__tests__/validate-player.test.ts`

### 8.2 Integration tests
- **File**: `web-next/tests/e2e/registration-flow.spec.ts`
- **Test**: Full flow: register → get code → approve → login

### 8.3 Documentation
- **File**: `docs/user-guide.md` - Add registration section
- **File**: `web-next/docs/SYSTEM_MANUAL.md` - Add registration system docs

## Implementation Notes

- **Verification code format**: Use readable words + numbers (e.g., "PURPLE42") for easy typing in game chat
- **Clan detection**: Use existing `getActiveClanConfig()` based on subdomain
- **Player validation**: Must be in current clan roster (last 7 days of snapshots)
- **Expiration**: 24 hours default, configurable
- **Leader workflow**: Simple approve/reject buttons in Leadership dashboard
- **No external services**: Everything uses existing Supabase and roster data

## Implementation Todos

- [ ] Create pending_registrations table migration
- [ ] Create /register page with player tag input form
- [ ] Create POST /api/register endpoint with validation and code generation
- [ ] Implement verification code generator (readable format)
- [ ] Implement player tag validation (check clan membership)
- [ ] Create PendingRegistrations component for Leadership dashboard
- [ ] Create POST /api/register/approve endpoint (create user, link player tag)
- [ ] Create POST /api/register/reject endpoint
- [ ] Create GET /api/register/pending endpoint (leadership only)
- [ ] Implement auto-create Supabase user on approval
- [ ] Create cleanup job for expired registrations
- [ ] Add rate limiting to registration endpoint
- [ ] Add duplicate prevention checks
- [ ] Create /register/status page
- [ ] Add copy-to-clipboard button for verification code
- [ ] Add step-by-step instructions to registration page
- [ ] Integrate PendingRegistrations into Leadership Dashboard
- [ ] Write unit tests for code generator and validation
- [ ] Write E2E test for full registration flow
- [ ] Update user-guide.md with registration instructions
- [ ] Update SYSTEM_MANUAL.md with registration system docs

