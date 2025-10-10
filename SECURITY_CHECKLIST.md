# 🔐 Security Checklist

## ⚠️ **NEVER Commit These to Git**

### Credentials & Secrets
- ❌ API keys (CoC, OpenAI, etc.)
- ❌ Database credentials (Supabase service role key)
- ❌ Proxy credentials (Fixie URL with password)
- ❌ Admin API keys
- ❌ Cron secrets
- ❌ JWT secrets
- ❌ OAuth client secrets

### Files That Should NEVER Be Committed
- ❌ `.env.local`
- ❌ `.env.production`
- ❌ Any file containing actual credential values
- ❌ Debug logs with credential echoes
- ❌ Investigation docs with example API calls showing auth headers

---

## ✅ **Safe to Commit**

### Templates & Examples
- ✅ `env.example` with placeholder values like `your_api_key_here`
- ✅ Documentation with `[REDACTED]` or `***` for sensitive values
- ✅ Code that reads from `process.env` variables

### Proper Examples
```bash
# ❌ WRONG - Never put real credentials
FIXIE_URL="http://fixie:Oug81SdBkZnv9Kd@criterium.usefixie.com:80"

# ✅ CORRECT - Use placeholders
FIXIE_URL="http://fixie:YOUR_PASSWORD_HERE@criterium.usefixie.com:80"
```

---

## 🔍 **Pre-Commit Checks**

Before every commit:
1. Search for common patterns:
   ```bash
   git diff --cached | grep -i "password\|api.key\|secret\|token" 
   ```

2. Check for specific services:
   ```bash
   git diff --cached | grep -E "(fixie|supabase|openai|clashofclans).*[:=].*[a-zA-Z0-9]{20,}"
   ```

3. Verify `.gitignore` is working:
   ```bash
   git status --ignored
   ```

---

## 🚨 **If You Accidentally Commit a Secret**

### DO NOT just delete the file! The secret is still in Git history.

### Option 1: Rotate the Credential (RECOMMENDED)
1. **Immediately rotate** the exposed credential
2. Update with new credential in `.env.local` and Vercel
3. Verify old credential no longer works
4. Dismiss GitHub security alert (mark as "Revoked")

### Option 2: Rewrite Git History (DANGEROUS)
⚠️ Only if absolutely necessary and you coordinate with your team:
```bash
# Remove file from all history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/file' \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (COORDINATE WITH TEAM FIRST!)
git push origin --force --all
```

---

## 🛡️ **GitHub Secret Scanning**

GitHub automatically scans for exposed secrets. When detected:
- ✅ You'll get an email alert
- ✅ A security alert appears in repo settings
- ✅ The secret is flagged in the file/commit

**To resolve**:
1. Rotate the credential immediately
2. Go to Settings → Security → Secret scanning alerts
3. Dismiss the alert and mark as "Revoked"

---

## 📋 **Credential Rotation Guide**

### Clash of Clans API Key
1. Visit: https://developer.clashofclans.com/
2. Log in → "My Account"
3. Create new key with same IP restrictions
4. Delete old key
5. Update `COC_API_KEY` in `.env.local` and Vercel

### Fixie Proxy
1. Visit: https://usefixie.com/
2. Dashboard → Settings
3. Rotate credentials
4. Copy new `FIXIE_URL`
5. Update in `.env.local` and Vercel

### Supabase Service Role Key
1. Visit Supabase project dashboard
2. Settings → API
3. **Cannot rotate** - would require creating new project
4. **Instead**: Use RLS policies to limit damage

### Admin/Cron Secrets
1. Generate new random string:
   ```bash
   openssl rand -base64 32
   ```
2. Update `ADMIN_API_KEY` and `CRON_SECRET`
3. Update in `.env.local` and Vercel

---

## 🎓 **Best Practices**

1. **Use environment variables** for ALL secrets
2. **Never hardcode** credentials in code or docs
3. **Use placeholders** in examples: `YOUR_KEY_HERE`, `[REDACTED]`, `***`
4. **Review diffs** before committing
5. **Rotate regularly** even if not exposed (every 90 days)
6. **Use 1Password/Secrets Manager** for team sharing

---

**Document Created**: 2025-10-09  
**Status**: ACTIVE SECURITY GUIDE  
**Required Reading**: Before every commit

