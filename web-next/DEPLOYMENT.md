# Clash Intelligence Dashboard - Deployment Guide

## Vercel Deployment

### Prerequisites
1. Vercel account (free tier available)
2. Clash of Clans API token
3. OpenAI API key (optional, for AI features)

### Environment Variables
Set these in your Vercel project settings:

```
COC_API_TOKEN=your_clash_of_clans_api_token_here
COC_API_BASE=https://api.clashofclans.com/v1
OPENAI_API_KEY=your_openai_api_key_here (optional)
CRON_SECRET=your_secure_random_string_here
NODE_ENV=production
```

### Deployment Steps

1. **Connect to Vercel:**
   ```bash
   npm i -g vercel
   vercel login
   vercel
   ```

2. **Set Environment Variables:**
   - Go to your Vercel project dashboard
   - Navigate to Settings > Environment Variables
   - Add all required variables listed above

3. **Deploy:**
   ```bash
   vercel --prod
   ```

### Post-Deployment

1. **Test the deployment:**
   - Visit your Vercel URL
   - Verify auto-loading works
   - Test all features

2. **Set up Cron Jobs (Optional):**
   - Configure daily snapshots using Vercel Cron
   - Set up departure notifications

## Supabase Integration (Future)

The current version uses local file storage. For production scale, consider migrating to Supabase:

1. **Database Schema:**
   - Members table
   - Snapshots table
   - Changes table
   - Player notes table

2. **Migration Steps:**
   - Export current data
   - Set up Supabase project
   - Migrate data
   - Update API endpoints

## Troubleshooting

### Common Issues:
- **Auto-loading not working:** Check COC_API_TOKEN is set correctly
- **AI features not working:** Check OPENAI_API_KEY is set
- **File operations failing:** Check dataRoot paths in production

### Support:
- Check Vercel function logs
- Verify environment variables
- Test API endpoints individually
