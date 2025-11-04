#!/bin/bash
# Script to check latest Vercel deployment status

echo "Checking latest Vercel deployment..."
vercel ls --limit 1 2>&1 || echo "⚠️  Vercel CLI not authenticated. Run: vercel login"

# Alternative: Check via GitHub commits to see if latest commit has been deployed
echo ""
echo "Latest commit:"
git log -1 --oneline

echo ""
echo "To monitor builds:"
echo "1. Share build logs when they fail (I'll fix immediately)"
echo "2. Or authenticate: vercel login (then I can monitor directly)"


