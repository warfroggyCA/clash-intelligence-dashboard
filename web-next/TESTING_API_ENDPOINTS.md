# Testing API Endpoints

## Test CoC API with Fixie Proxy

### Prerequisites

1. Get your `ADMIN_API_KEY` from Vercel:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Find `ADMIN_API_KEY` (or `INGESTION_TRIGGER_KEY`)
   - Copy the value

2. Get your production URL:
   - From Vercel Dashboard → Your Project → Deployments
   - Or use your custom domain

### Method 1: Test CoC API Endpoint (Makes Real API Call)

```bash
# Replace YOUR_ADMIN_API_KEY with your actual key
# Replace YOUR_APP_URL with your Vercel URL (e.g., https://your-app.vercel.app)

curl -X GET \
  "https://YOUR_APP_URL/api/debug/test-coc-api" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json"
```

**What it does:**
- Makes an actual CoC API call to `/clans/#2PR8R8V8P`
- Shows detailed diagnostics about Fixie configuration
- Shows environment detection (production vs development)
- Shows if proxy is being used
- Returns full error details if it fails

**Expected Success Response:**
```json
{
  "success": true,
  "diagnostics": {
    "environment": {
      "nodeEnv": "production",
      "vercelEnv": "production",
      "isProduction": true,
      "isDevelopment": false
    },
    "fixie": {
      "urlConfigured": true,
      "urlLength": 50,
      "disabled": false,
      "allowFallback": false
    },
    "cocApi": {
      "tokenConfigured": true,
      "tokenLength": 100,
      "baseUrl": "https://api.clashofclans.com/v1"
    }
  },
  "apiCall": {
    "clanTag": "#2PR8R8V8P",
    "normalizedTag": "#2PR8R8V8P",
    "durationMs": 1234,
    "success": true,
    "clanData": {
      "name": "Clan Name",
      "tag": "#2PR8R8V8P",
      "memberCount": 50
    }
  }
}
```

**If it fails with 403:**
```json
{
  "success": false,
  "error": "CoC API 403 Forbidden: {\"reason\":\"accessDenied\"}",
  "errorDetails": {
    "status": 403,
    "proxied": true,
    "message": "..."
  }
}
```

### Method 2: Check Fixie Configuration (No API Call)

```bash
curl -X GET \
  "https://YOUR_APP_URL/api/debug/fixie-config" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

**What it shows:**
- Whether FIXIE_URL is set
- Whether proxy is enabled
- Whether CoC API token is configured
- Environment variables

### Method 3: Get Fixie IP Addresses

```bash
curl -X GET \
  "https://YOUR_APP_URL/api/debug/fixie-ip" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

**What it shows:**
- The actual IP addresses Fixie is using
- Recommendation for whitelisting in CoC API settings

## Viewing Vercel Function Logs

After running the test, check the logs:

1. Go to Vercel Dashboard → Your Project → Functions
2. Click on any recent function invocation
3. Or go to the "Logs" tab

Look for these log messages:
- `[CoC API] Proxy config` - Shows environment and proxy configuration
- `[API Call] (proxy via Fixie ...)` - Confirms proxy is being used
- `[API Call] (proxy) Making request to:` - Shows the exact API call
- `[API Call] (proxy) FAILED` - Shows the error if it fails

## Troubleshooting

### If you get 401 Unauthorized:
- Verify `ADMIN_API_KEY` is set in Vercel environment variables
- Make sure you're using `Bearer YOUR_KEY` format in the Authorization header
- Check that the key matches exactly (no extra spaces)

### If you get 403 Forbidden:
- Check Vercel logs to confirm Fixie is being used
- Verify Fixie IPs are whitelisted in CoC API key settings
- Check if API token is valid and not expired
- Verify API token has correct permissions

### If proxy isn't being used:
- Check `FIXIE_URL` is set in Vercel environment variables
- Check `COC_DISABLE_PROXY` is not set to `true`
- Verify environment detection (should be production)


