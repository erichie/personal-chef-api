# Personal Chef Next - Quick Reference

## 🚀 Quick Start

```bash
# 1. Copy environment file
cp .env.example .env.local

# 2. Update .env.local with your values (especially DATABASE_URL)

# 3. Run setup script
./setup.sh

# 4. Start development
npm run dev
```

## 📡 API Endpoints Quick Reference

### Authentication

```
POST   /api/auth/sign-up        Create account
POST   /api/auth/sign-in         Sign in
POST   /api/auth/sign-out        Sign out
GET    /api/auth/session         Get session info
POST   /api/auth/guest           Create guest user
POST   /api/auth/link-device     Link device to account
```

### Data Sync

```
POST   /api/sync                 Upload device state
GET    /api/sync                 Download user backup
```

### AI Features

```
POST   /api/ai/meal-plan         Generate meal plan
POST   /api/ai/replace-recipe    Replace recipe
POST   /api/ai/parse-recipe      Parse recipe from URL
```

## 🔑 Authentication Methods

1. **Session Token** (registered users):

   ```bash
   -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Device ID** (guest users):

   ```bash
   -H "X-Device-ID: your-device-id"
   ```

3. **Cookie** (browser):
   ```
   Cookie: better-auth.session_token=YOUR_TOKEN
   ```

## 🗄️ Database Commands

```bash
npm run db:generate     # Generate Prisma Client
npm run db:migrate      # Run migrations
npm run db:studio       # Open database GUI
npm run db:push         # Push schema without migration
npm run db:reset        # Reset database (DANGER!)
```

## 📝 Environment Variables

### Required

- `DATABASE_URL` - PostgreSQL connection
- `BETTER_AUTH_SECRET` - Auth secret (32+ chars)
- `BETTER_AUTH_URL` - App URL

### Optional

- `OPENAI_API_KEY` - For AI features
- `GOOGLE_CLIENT_ID` - For OAuth
- `GOOGLE_CLIENT_SECRET` - For OAuth

## 📚 Documentation Files

- `BACKEND_README.md` - Complete backend guide
- `API_EXAMPLES.md` - API examples with cURL
- `POSTGRES_SETUP.md` - Database setup
- `IMPLEMENTATION_SUMMARY.md` - What was built

## 🔧 Useful Commands

```bash
# Development
npm run dev             # Start dev server
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run db:studio       # Database GUI
npm run db:migrate      # Run migrations

# Code Quality
npm run lint            # Lint code
npx tsc --noEmit        # Type check
```

## 🐛 Common Issues

### Database Connection Failed

- Check PostgreSQL is running: `brew services list`
- Verify DATABASE_URL in .env.local
- Test connection: `psql personal_chef_dev`

### Prisma Client Not Found

```bash
npm run db:generate
```

### Migration Errors

```bash
npm run db:reset        # WARNING: Deletes all data
npm run db:migrate
```

### OpenAI API Errors

- Check OPENAI_API_KEY is set
- Verify API key is valid
- Check OpenAI billing/quota

## 📦 Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Prisma + PostgreSQL
- better-auth
- OpenAI GPT-4
- Vercel AI SDK
- Zod validation

## 🎯 Key Features

✅ Guest user system with device linking  
✅ Cloud sync with device-first strategy  
✅ AI meal planning with GPT-4  
✅ AI recipe replacement  
✅ Multi-method authentication  
✅ Type-safe database operations  
✅ Comprehensive error handling  
✅ Production ready

## 🚢 Deployment Checklist

- [ ] Set up production database
- [ ] Update all environment variables
- [ ] Run database migrations
- [ ] Test all endpoints
- [ ] Enable OpenAI API
- [ ] Configure OAuth (optional)
- [ ] Set up monitoring
- [ ] Configure CORS for production domains

## 📱 Example: Create Guest & Sync Data

```bash
# 1. Create guest user
curl -X POST http://localhost:3000/api/auth/guest \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "my-device-123"}'

# Save the returned token

# 2. Sync data
curl -X POST http://localhost:3000/api/sync \
  -H "X-Device-ID: my-device-123" \
  -H "Content-Type: application/json" \
  -d '{"chefIntake": {...}, "inventory": [...]}'
```

## 💡 Tips

- Use Prisma Studio to inspect data: `npm run db:studio`
- Check server logs for detailed errors
- Test with cURL before integrating frontend
- Keep .env.local out of git (already gitignored)
- Generate strong auth secret: `openssl rand -base64 32`

---

For complete documentation, see `BACKEND_README.md`
