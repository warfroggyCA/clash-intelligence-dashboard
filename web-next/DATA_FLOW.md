# 📊 Data Flow Strategy - Clash Intelligence Dashboard

## Overview

This document explains how data flows between different environments to ensure data preservation and safe development.

## Environment Data Sources

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

## Data Flow Rules

### ✅ **What Happens in Each Environment**

#### Local Development
1. **Loads data from local files** (`../out/snapshots/`, `../out/changes/`)
2. **Falls back to baseline data** (`../data/`) if no local snapshots
3. **Never touches Supabase** unless explicitly requested
4. **Preserves all local data** - no data loss risk

#### Staging Environment
1. **Loads data from Supabase staging project**
2. **Writes new data to Supabase staging project**
3. **Separate from production data** - safe testing
4. **Can be reset/cleared** without affecting production

#### Production Environment
1. **Loads data from Supabase production project**
2. **Writes new data to Supabase production project**
3. **Contains all real clan data** - must be preserved
4. **Backed up regularly** - data loss protection

### 🔄 **Data Flow Between Environments**

```
Local Development
    ↓ (manual export)
Staging Environment
    ↓ (tested & approved)
Production Environment
```

**No automatic data flow** - each environment is isolated for safety.

## Data Preservation Strategy

### 🛡️ **Production Data Protection**
- **Separate Supabase projects** for staging and production
- **Regular backups** of production database
- **No direct production access** from development
- **Staging validation** before production deployment

### 📁 **Local Data Management**
- **Local files preserved** - never overwritten by Supabase
- **Fallback system** - uses baseline data if no local snapshots
- **Manual refresh** - only when explicitly requested
- **Version control** - local data can be committed to Git

### 🔄 **Data Refresh Options**

#### Local Development
```bash
# Use local data (default)
USE_LOCAL_DATA=true

# Force refresh from Supabase (when needed)
USE_LOCAL_DATA=false
```

#### Staging/Production
- **Automatic Supabase sync** - always uses database
- **No local file fallback** - pure database environment
- **Real-time data** - always current

## Configuration Examples

### Local Development (.env.local)
```bash
# Use local data for development
USE_LOCAL_DATA=true
NODE_ENV=development
VERCEL_ENV=development

# Supabase (only used when USE_LOCAL_DATA=false)
NEXT_PUBLIC_SUPABASE_URL=your_dev_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_dev_supabase_key
```

### Staging Environment (Vercel)
```bash
# Use Supabase staging project
USE_LOCAL_DATA=false
NODE_ENV=production
VERCEL_ENV=preview

# Staging Supabase project
NEXT_PUBLIC_SUPABASE_URL=your_staging_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_staging_supabase_key
```

### Production Environment (Vercel)
```bash
# Use Supabase production project
USE_LOCAL_DATA=false
NODE_ENV=production
VERCEL_ENV=production

# Production Supabase project
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_key
```

## Data Safety Checklist

### ✅ **Before Development**
- [ ] Local data files exist (`../out/snapshots/`, `../out/changes/`)
- [ ] `USE_LOCAL_DATA=true` in `.env.local`
- [ ] Supabase credentials configured (for when needed)

### ✅ **Before Staging Deployment**
- [ ] Staging Supabase project created
- [ ] Staging environment variables configured
- [ ] Test data loaded in staging

### ✅ **Before Production Deployment**
- [ ] Production Supabase project backed up
- [ ] Staging environment tested thoroughly
- [ ] Production environment variables configured
- [ ] Rollback plan ready

## Troubleshooting

### Common Issues

#### "No data found" in local development
- **Cause**: No local snapshots or fallback data
- **Solution**: Run data collection or set `USE_LOCAL_DATA=false`

#### "Supabase connection failed" in staging
- **Cause**: Wrong Supabase credentials or project
- **Solution**: Check environment variables in Vercel

#### "Data not syncing" between environments
- **Cause**: Different Supabase projects or local data mode
- **Solution**: Verify data source configuration

### Debug Commands
```bash
# Check current data source
npm run env:check

# Test local data loading
USE_LOCAL_DATA=true npm run dev

# Test Supabase data loading
USE_LOCAL_DATA=false npm run dev
```

## Best Practices

1. **Always develop locally first** - use local data
2. **Test in staging** - verify Supabase integration
3. **Deploy to production** - only when staging is perfect
4. **Backup production data** - before major changes
5. **Monitor data flow** - check logs for data source usage
6. **Preserve local data** - commit important snapshots to Git

## Data Migration

### Moving from Local to Supabase
```bash
# Export local data
npm run export:local-data

# Import to staging
npm run import:staging-data

# Test staging
npm run deploy:staging

# Import to production (after testing)
npm run import:production-data
```

### Moving from Supabase to Local
```bash
# Export from Supabase
npm run export:supabase-data

# Save to local files
npm run save:local-data

# Switch to local mode
USE_LOCAL_DATA=true npm run dev
```

This data flow strategy ensures you can develop safely without losing any data, while maintaining proper separation between environments.
