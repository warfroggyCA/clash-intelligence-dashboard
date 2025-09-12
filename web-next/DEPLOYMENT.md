# 🚀 Deployment Guide - Clash Intelligence Dashboard

## Environment Setup

### 1. Local Development
```bash
# Install dependencies
npm install

# Copy environment template
cp env.example .env.local

# Edit .env.local with your actual values
nano .env.local

# Check environment variables
npm run env:check

# Start development server
npm run dev
```

### 2. Vercel Environments

#### Development (Local)
- **URL**: `http://localhost:5050`
- **Environment**: `development`
- **Database**: Uses your local Supabase instance
- **Purpose**: Feature development and testing

#### Staging (Preview)
- **URL**: `https://clash-intelligence-git-[branch]-yourusername.vercel.app`
- **Environment**: `preview`
- **Database**: Staging Supabase project
- **Purpose**: Integration testing and client review

#### Production
- **URL**: `https://clash-intelligence.vercel.app`
- **Environment**: `production`
- **Database**: Production Supabase project
- **Purpose**: Live application

## Deployment Workflow

### Step 1: Development
```bash
# Create feature branch
git checkout -b feature/leadership-access-control

# Make changes
# Test locally
npm run dev
npm run env:check

# Commit changes
git add .
git commit -m "feat: add leadership access control system"
```

### Step 2: Staging Deployment
```bash
# Push to staging branch
git checkout staging
git merge feature/leadership-access-control
git push origin staging

# Deploy to staging
npm run deploy:staging

# Test staging environment
# Verify all features work correctly
```

### Step 3: Production Deployment
```bash
# Merge to main branch
git checkout main
git merge staging
git push origin main

# Deploy to production
npm run deploy:prod

# Verify production deployment
```

## Environment Variables

### Required Variables
- `COC_API_KEY`: Clash of Clans API key
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `OPENAI_API_KEY`: OpenAI API key for AI summaries

### Optional Variables
- `DEFAULT_CLAN_TAG`: Default clan tag (default: #2PR8R8V8P)
- `DEV_MODE`: Enable development features (default: false)
- `ENABLE_DEBUG_LOGGING`: Enable debug logging (default: false)

### Data Source Configuration
- `USE_LOCAL_DATA`: Use local files for development (default: true in dev)
- `MOCK_API_CALLS`: Mock API calls for testing (default: false)
- `USE_TEST_DATA`: Use test data instead of real data (default: false)

## Data Flow Strategy

### 🏠 **Local Development**
- **Data Source**: Local files (`../out/` and `../data/`)
- **Database**: None (uses local JSON files)
- **Purpose**: Safe development without affecting live data
- **Configuration**: `USE_LOCAL_DATA=true`

### 🧪 **Staging Environment**
- **Data Source**: Supabase (staging project)
- **Database**: Separate Supabase project for staging
- **Purpose**: Integration testing with real database
- **Configuration**: `VERCEL_ENV=preview`

### 🚀 **Production Environment**
- **Data Source**: Supabase (production project)
- **Database**: Production Supabase project
- **Purpose**: Live application with real data
- **Configuration**: `VERCEL_ENV=production`

**Key Benefits**:
- ✅ **No data loss risk** - local development uses local files
- ✅ **Data preservation** - production data never touched during development
- ✅ **Safe testing** - staging uses separate database
- ✅ **Easy rollback** - each environment is isolated

See `DATA_FLOW.md` for complete data flow documentation.

## Vercel Configuration

### Environment Variables in Vercel
1. Go to your Vercel project dashboard
2. Navigate to Settings > Environment Variables
3. Add variables for each environment:
   - **Development**: Use your test API keys
   - **Preview**: Use staging API keys
   - **Production**: Use production API keys

### Branch Configuration
- **Production**: `main` branch
- **Preview**: `staging` branch
- **Development**: Any other branch

## Safety Checklist

### Before Deploying to Production
- [ ] All tests pass locally
- [ ] Staging environment tested thoroughly
- [ ] Environment variables configured correctly
- [ ] Database migrations applied (if any)
- [ ] No console.log statements in production code
- [ ] Error handling implemented
- [ ] Performance optimized

### Rollback Plan
If production deployment fails:
1. Revert to previous commit
2. Force push to main branch
3. Vercel will automatically redeploy

## Troubleshooting

### Common Issues
1. **Environment variables not loading**: Check Vercel environment settings
2. **Build failures**: Check build logs in Vercel dashboard
3. **API errors**: Verify API keys and endpoints
4. **Database connection issues**: Check Supabase configuration

### Debug Commands
```bash
# Check environment variables
npm run env:check

# Test build locally
npm run build

# Test production build
npm run build:staging
```

## Best Practices

1. **Never develop directly in production**
2. **Always test in staging first**
3. **Use feature branches for new development**
4. **Keep environment variables secure**
5. **Monitor deployment logs**
6. **Have a rollback plan ready**

## Emergency Procedures

### If Production is Down
1. Check Vercel dashboard for errors
2. Check Supabase dashboard for database issues
3. Check API key validity
4. Rollback to last known good commit if necessary

### Contact Information
- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **Supabase Support**: [supabase.com/support](https://supabase.com/support)
- **Project Owner**: [Your contact info]