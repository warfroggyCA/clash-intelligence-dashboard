# Automated Daily Snapshots Setup

This guide explains how to set up automated daily snapshots at 3 AM.

## Environment Variables

Add these to your `.env.local` file:

```bash
# OpenAI API Key for AI summaries (optional - will use fallback summaries if not provided)
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Secret for cron job authentication
CRON_SECRET=your_secret_key_here
```

## Cron Job Setup

### Option 1: Using crontab (Linux/macOS)

1. Open your crontab:
   ```bash
   crontab -e
   ```

2. Add this line to run at 3 AM daily:
   ```bash
   0 3 * * * curl -H "Authorization: Bearer your_secret_key_here" http://localhost:5050/api/cron/daily-snapshot
   ```

### Option 2: Using a cron service (Recommended for production)

For production deployment, consider using:
- **Vercel Cron Jobs** (if deploying to Vercel)
- **GitHub Actions** with scheduled workflows
- **AWS Lambda** with EventBridge
- **Google Cloud Functions** with Cloud Scheduler

### Option 3: GitHub Actions (Free option)

Create `.github/workflows/daily-snapshot.yml`:

```yaml
name: Daily Clan Snapshot
on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM UTC daily
  workflow_dispatch:  # Allow manual triggers

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Daily Snapshot
        run: |
          curl -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
               ${{ secrets.APP_URL }}/api/cron/daily-snapshot
```

## Manual Testing

Test the cron endpoint manually:

```bash
# Without authentication (if CRON_SECRET not set)
curl http://localhost:5050/api/cron/daily-snapshot

# With authentication
curl -H "Authorization: Bearer your_secret_key_here" \
     http://localhost:5050/api/cron/daily-snapshot
```

## Data Storage

Snapshots and changes are stored in:
- `../out/snapshots/` - Daily snapshots
- `../out/changes/` - Change summaries

## Features

- **Automatic Change Detection**: Compares daily snapshots to detect:
  - New/left members
  - Hero upgrades
  - Town Hall upgrades
  - Trophy changes
  - Donation activity
  - Role changes

- **AI-Powered Summaries**: Uses OpenAI to generate engaging summaries
- **Read/Actioned Tracking**: Mark summaries as read or actioned
- **Fallback Summaries**: Works without OpenAI API key

## Monitoring

Check the application logs for cron job execution:
```bash
# Look for [CRON] log entries
tail -f your_app_logs | grep "\[CRON\]"
```
