# Preview Environment Setup

## 🚨 CRITICAL: Preview Deployments Require Anonymous Access

Preview and development environments **MUST** have authentication disabled for testing.

---

## ⚙️ Required Vercel Environment Variables

### For Preview & Development Environments:

Add these environment variables in **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Value | Environments | Required? |
|----------|-------|--------------|-----------|
| `NEXT_PUBLIC_ALLOW_ANON_ACCESS` | `true` | ✅ Preview, ✅ Development | **YES** |
| `DEV_MODE` | `true` | ✅ Preview, ✅ Development | Recommended |

**DO NOT** enable these for Production! ❌

---

## 📋 Step-by-Step Setup

### 1. Open Vercel Dashboard
- Go to: https://vercel.com/
- Select your project: `clash-intelligence-dashboard`

### 2. Add Environment Variables
- Click **Settings** (top navigation)
- Click **Environment Variables** (left sidebar)
- Click **Add New** button

### 3. Add Anonymous Access Variable
```
Key:   NEXT_PUBLIC_ALLOW_ANON_ACCESS
Value: true

Environments:
✅ Preview
✅ Development
❌ Production (leave unchecked!)
```
Click **Save**

### 4. Add Dev Mode Variable (Optional)
```
Key:   DEV_MODE
Value: true

Environments:
✅ Preview
✅ Development
❌ Production
```
Click **Save**

### 5. Redeploy
- Go to **Deployments** tab
- Find your latest deployment
- Click **"..."** menu → **Redeploy**
- Or push a new commit to trigger deployment

---

## 🔍 How It Works

### AuthGuard Component
File: `/src/components/layout/AuthGuard.tsx`

```tsx
// Lines 36-38
if (process.env.NEXT_PUBLIC_ALLOW_ANON_ACCESS === 'true') {
  return <>{children}</>;
}
```

When `NEXT_PUBLIC_ALLOW_ANON_ACCESS=true`:
- ✅ No login required
- ✅ Anonymous access allowed
- ✅ Can test all features
- ✅ Impersonation set to 'leader' role automatically

When `NEXT_PUBLIC_ALLOW_ANON_ACCESS=false` or not set:
- ❌ Redirects to /login
- ❌ Requires authentication
- ❌ Cannot access dashboard without signing in

---

## 🎯 Environments Configuration

| Environment | Login Required? | Variable Setting |
|-------------|----------------|------------------|
| **Production** (heckyeah.clashintelligence.com) | ✅ YES | `NEXT_PUBLIC_ALLOW_ANON_ACCESS=false` or not set |
| **Preview** (Vercel preview URLs) | ❌ NO | `NEXT_PUBLIC_ALLOW_ANON_ACCESS=true` |
| **Development** (localhost:3000) | ❌ NO | `NEXT_PUBLIC_ALLOW_ANON_ACCESS=true` |

---

## 🐛 Troubleshooting

### Problem: Preview deployment shows login screen

**Symptoms:**
- Preview URL redirects to `/login`
- "Sign In Required" message appears
- Cannot access dashboard

**Solution:**
1. Check Vercel environment variables (Settings → Environment Variables)
2. Verify `NEXT_PUBLIC_ALLOW_ANON_ACCESS=true` is set for Preview
3. Redeploy the preview branch
4. Clear browser cache if needed

---

### Problem: Local development requires login

**Solution:**
Create `.env.local` in `/web-next/` with:
```bash
NEXT_PUBLIC_ALLOW_ANON_ACCESS=true
DEV_MODE=true
```

Then restart dev server:
```bash
npm run dev
```

---

## ⚠️ Security Notes

- **DO NOT** enable anonymous access in production
- Only use for preview/development environments
- Preview URLs are still private (not indexed by search engines)
- Vercel generates unique URLs for each deployment
- Consider adding Vercel Password Protection for extra security on previews

---

## ✅ Verification

After setting environment variables:

1. **Deploy preview branch**
2. **Open preview URL**
3. **Should see dashboard immediately** (no login screen)
4. **Can navigate all pages** without authentication

If login screen still appears:
- Environment variable not set correctly
- Needs redeploy
- Check browser console for errors

---

## 📞 Questions?

Refer to:
- `/web-next/src/components/layout/AuthGuard.tsx` - Auth logic
- `/web-next/env.example` - Example environment variables
- Vercel documentation: https://vercel.com/docs/environment-variables
