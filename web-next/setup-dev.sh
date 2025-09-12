#!/bin/bash

# Clash Intelligence Dashboard - Development Setup Script
echo "🏰 Setting up Clash Intelligence Dashboard for development..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the web-next directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from template..."
    cp env.example .env.local
    echo "✅ Created .env.local - Please edit it with your actual values"
else
    echo "✅ .env.local already exists"
fi

# Check environment variables
echo "🔍 Checking environment variables..."
npm run env:check

# Create staging branch if it doesn't exist
echo "🌿 Setting up Git branches..."
if ! git branch | grep -q "staging"; then
    git checkout -b staging
    echo "✅ Created staging branch"
else
    echo "✅ Staging branch already exists"
fi

# Return to main branch
git checkout main

echo ""
echo "🎉 Setup complete! Next steps:"
echo "1. Edit .env.local with your actual API keys"
echo "2. Run 'npm run dev' to start development server"
echo "3. Run 'npm run deploy:staging' to deploy to staging"
echo "4. Run 'npm run deploy:prod' to deploy to production"
echo ""
echo "📚 See DEPLOYMENT.md for complete deployment guide"
