#!/bin/bash

# Personal Chef Next - Quick Start Script
# This script helps set up the development environment

set -e

echo "🍳 Personal Chef Next - Setup"
echo "=============================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "⚠️  .env.local not found. Copying from .env.example..."
  cp .env.example .env.local
  echo "✅ Created .env.local"
  echo ""
  echo "📝 Please update the following in .env.local:"
  echo "   - DATABASE_URL (your PostgreSQL connection string)"
  echo "   - BETTER_AUTH_SECRET (generate with: openssl rand -base64 32)"
  echo "   - OPENAI_API_KEY (optional, for AI features)"
  echo "   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (optional, for OAuth)"
  echo ""
  read -p "Press Enter after you've updated .env.local..."
else
  echo "✅ .env.local already exists"
fi

# Check if PostgreSQL is running (macOS with Homebrew)
if command -v psql &> /dev/null; then
  echo "✅ PostgreSQL client found"
  
  # Try to connect to database
  if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw personal_chef_dev; then
    echo "✅ Database 'personal_chef_dev' exists"
  else
    echo "⚠️  Database 'personal_chef_dev' not found"
    read -p "Create database now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      createdb personal_chef_dev
      echo "✅ Created database 'personal_chef_dev'"
    else
      echo "⏭️  Skipping database creation"
    fi
  fi
else
  echo "⚠️  PostgreSQL not found. Please install it:"
  echo "   brew install postgresql@16"
  echo "   See POSTGRES_SETUP.md for detailed instructions"
  exit 1
fi

echo ""
echo "📦 Generating Prisma Client..."
npm run db:generate

echo ""
echo "🔄 Running database migrations..."
npm run db:migrate

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 You can now start the development server:"
echo "   npm run dev"
echo ""
echo "📚 Useful commands:"
echo "   npm run db:studio    - Open Prisma Studio (database GUI)"
echo "   npm run db:migrate   - Run migrations"
echo "   npm run db:reset     - Reset database (WARNING: deletes data)"
echo ""
echo "📖 Documentation:"
echo "   - BACKEND_README.md  - Backend overview"
echo "   - API_EXAMPLES.md    - API usage examples"
echo "   - POSTGRES_SETUP.md  - Database setup guide"

