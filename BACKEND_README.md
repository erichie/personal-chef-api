# Personal Chef Next - Backend Implementation

Full-stack meal planning and cooking assistant built with Next.js 16, PostgreSQL, and AI.

## 🚀 Features

- **Authentication**: better-auth with email/password and OAuth (Google)
- **Guest Mode**: Device-based guest users with seamless account linking
- **Data Sync**: Cloud backup and sync for user profiles and recipes
- **AI-Powered**: Meal plan generation and recipe replacement using OpenAI GPT-4
- **Type-Safe**: Full TypeScript with Prisma ORM
- **Production Ready**: Error handling, validation, and middleware protection

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 16+ (see [POSTGRES_SETUP.md](./POSTGRES_SETUP.md))
- OpenAI API key (optional for development)

## 🛠️ Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and update values:

```bash
cp .env.example .env.local
```

**Required variables:**

- `DATABASE_URL`: PostgreSQL connection string
- `BETTER_AUTH_SECRET`: Random secret (min 32 characters)
- `BETTER_AUTH_URL`: Your app URL (http://localhost:3000 for dev)

**Optional (for full functionality):**

- `OPENAI_API_KEY`: OpenAI API key
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials

### 3. Set Up Database

Follow instructions in [POSTGRES_SETUP.md](./POSTGRES_SETUP.md) to install and configure PostgreSQL.

### 4. Run Database Migration

```bash
npx prisma migrate dev --name init
```

This will:

- Create all database tables
- Generate Prisma Client

### 5. Start Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3000

## 📁 Project Structure

```
/app
  /api
    /auth
      /[...all]         # better-auth handler
      /guest            # Guest user creation
      /link-device      # Link guest to account
    /ai
      /meal-plan        # AI meal plan generation
      /replace-recipe   # AI recipe replacement
    /sync               # Cloud sync endpoints

/lib
  - api-errors.ts       # Error handling utilities
  - auth.ts             # better-auth configuration
  - auth-utils.ts       # Auth helper functions
  - ai-utils.ts         # OpenAI integration
  - prisma.ts           # Prisma client singleton
  - types.ts            # TypeScript type definitions

/prisma
  - schema.prisma       # Database schema

middleware.ts           # Route protection
```

## 🔐 Authentication

### Guest Users

Create a guest user with device ID:

```bash
curl -X POST http://localhost:3000/api/auth/guest \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "device-123"}'
```

### Register Account

```bash
curl -X POST http://localhost:3000/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

### Link Guest to Account

```bash
curl -X POST http://localhost:3000/api/auth/link-device \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "device-123"}'
```

## 📡 API Endpoints

See [API_EXAMPLES.md](./API_EXAMPLES.md) for complete API documentation with examples.

### Authentication

- `POST /api/auth/sign-up` - Create account
- `POST /api/auth/sign-in` - Sign in
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get session
- `POST /api/auth/guest` - Create guest user
- `POST /api/auth/link-device` - Link device to account

### Data Sync

- `POST /api/sync` - Upload device state
- `GET /api/sync` - Download user backup

### AI Features

- `POST /api/ai/meal-plan` - Generate meal plan
- `POST /api/ai/replace-recipe` - Replace recipe
- `POST /api/ai/parse-recipe` - Parse recipe from URL

## 🗄️ Database Schema

### Core Models

- **User**: Authentication and user management
- **Session**: Session tokens
- **UserProfile**: JSON storage for flexible data (intake, inventory, meal plans, etc.)
- **Recipe**: Structured recipe storage
- **Friendship**: Future feature for friends

### Data Storage Strategy

User preferences and app state are stored as JSON in `UserProfile` for maximum flexibility:

- `chefIntake`: Onboarding preferences
- `inventory`: Pantry/fridge items
- `mealPlans`: Weekly meal plans
- `groceryList`: Shopping list
- `achievements`: Unlocked achievements
- `streaks`: Cooking and planning streaks
- `tokenState`: In-app token balance

Recipes are stored in a structured table for better querying and future sharing features.

## 🤖 AI Integration

The app uses OpenAI GPT-4 for:

1. **Meal Plan Generation**: Creates personalized weekly meal plans based on:

   - Cooking skill level and time constraints
   - Dietary restrictions and preferences
   - Available inventory
   - Cuisine and flavor preferences

2. **Recipe Replacement**: Suggests alternative recipes when users need to:
   - Reduce cooking time
   - Replace unavailable ingredients
   - Try different cuisines
   - Adjust difficulty level

**Note**: AI features require a valid `OPENAI_API_KEY` in your environment variables.

## 🛡️ Middleware & Protection

Protected routes (`/api/sync/*`, `/api/ai/*`) require authentication via:

- Session token: `Authorization: Bearer TOKEN`
- Cookie: `better-auth.session_token`
- Device ID: `X-Device-ID: device-id` (guest users)

## 🔧 Development Scripts

```bash
# Start dev server
npm run dev

# Run Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma Client
npx prisma generate

# Create new migration
npx prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Lint code
npm run lint

# Type check
npx tsc --noEmit
```

## 📦 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Database

Use a managed PostgreSQL service:

- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Supabase](https://supabase.com/)
- [Railway](https://railway.app/)
- [Neon](https://neon.tech/)

Update `DATABASE_URL` in Vercel environment variables.

### Environment Variables for Production

Ensure these are set in your hosting platform:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` (your production URL)
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

## 🧪 Testing

### Manual API Testing

Use the examples in [API_EXAMPLES.md](./API_EXAMPLES.md) to test endpoints manually.

### Database Verification

```bash
# Open Prisma Studio
npx prisma studio

# Check database connection
npx prisma db execute --stdin <<< "SELECT 1"
```

## 🐛 Troubleshooting

### Database Connection Issues

1. Verify PostgreSQL is running:

   ```bash
   brew services list | grep postgresql
   ```

2. Test connection:

   ```bash
   psql personal_chef_dev
   ```

3. Check DATABASE_URL format in `.env.local`

### Auth Issues

1. Ensure `BETTER_AUTH_SECRET` is at least 32 characters
2. Verify `BETTER_AUTH_URL` matches your app URL
3. Check browser console for CORS issues

### AI Endpoint Errors

1. Verify `OPENAI_API_KEY` is set and valid
2. Check OpenAI API quota and billing
3. Review error messages in terminal

## 📝 Notes

- **Guest Data Migration**: When linking a device, all guest data is automatically migrated to the authenticated account
- **Sync Strategy**: Device state is the source of truth - backend merges but prioritizes device data
- **Token System**: Placeholder for future gamification (achievement rewards, action costs)
- **External APIs**: OpenAI and Google OAuth are stubbed - graceful errors when credentials aren't configured
- **Production Ready**: All endpoints have proper error handling, validation, and security

## 🔮 Future Enhancements

- Email verification for new accounts
- Password reset flow
- Recipe sharing between friends
- Credit/token-based AI generation limits
- Webhook support for external integrations
- Mobile app support (React Native)
- Recipe photos and media storage

## 📄 License

Private project - All rights reserved

## 🤝 Support

For issues or questions, please contact the development team.
