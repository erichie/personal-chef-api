# AI Usage Tracking System

## Overview

Implemented a comprehensive AI usage tracking system with enforced limits on meal plan generation (8 per rolling 30 days) and tracking for all other AI endpoints.

## Database

### AiUsage Model

```prisma
model AiUsage {
  id        String   @id @default(uuid())
  userId    String
  endpoint  String   // meal-plan, generate-recipe, etc.
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([endpoint])
  @@index([userId, endpoint, createdAt])
}
```

## Configuration

### Limits (in `/lib/ai-usage-utils.ts`)

- `MEAL_PLAN_LIMIT = 8` - Easily adjustable
- `USAGE_WINDOW_DAYS = 30` - Rolling 30-day window
- Other endpoints: Tracked but unlimited

### Tracked Endpoints

1. **meal-plan** - Limited to 8/month
2. **generate-recipe** - Tracked, no limit
3. **replace-recipe** - Tracked, no limit
4. **parse-recipe** - Tracked, no limit
5. **generate-steps** - Tracked, no limit
6. **parse-pantry** - Tracked, no limit
7. **chat-instruction** - Tracked, no limit
8. **explain-instruction** - Tracked, no limit

## API Behavior

### Meal Plan Endpoint (`/api/ai/meal-plan`)

**Before generation:**

- Checks if user has reached limit
- Returns 429 error if exceeded

**After generation:**

- Records usage in database

**429 Response Example:**

```json
{
  "error": "Meal plan generation limit reached",
  "code": "LIMIT_EXCEEDED",
  "details": {
    "limit": 8,
    "used": 8,
    "remaining": 0,
    "resetsAt": "2025-11-27T12:34:56Z"
  }
}
```

### Other AI Endpoints

**After generation:**

- Silently track usage (no limits enforced)
- Tracking happens in background, doesn't affect response

## User API (`/api/me`)

### Response includes usage stats:

```json
{
  "user": {
    "id": "...",
    "email": "...",
    // ... other fields
    "mealPlanUsage": 3,
    "mealPlanLimit": 8,
    "mealPlanRemaining": 5,
    "mealPlanResetsAt": "2025-11-27T12:34:56Z"
  }
}
```

## Implementation Details

### Rolling 30-Day Window

- Each usage starts its own 30-day window
- Old usages automatically "expire" after 30 days
- Query: `WHERE createdAt >= NOW() - INTERVAL '30 days'`
- No cron jobs or cleanup needed

### Reset Date Calculation

- `resetsAt` shows when the **oldest** usage in the current window will expire
- Once that usage expires, the user regains 1 generation slot
- If not at limit, still shows when oldest usage will expire (for transparency)

## Future Extensions

### Adding Limits to Other Endpoints

To add a limit to any tracked endpoint:

1. Add constant to `/lib/ai-usage-utils.ts`:

```typescript
export const GENERATE_RECIPE_LIMIT = 50;
```

2. Create check function:

```typescript
export async function checkGenerateRecipeLimit(
  userId: string
): Promise<UsageLimitCheck> {
  // Similar to checkMealPlanLimit
}
```

3. Update endpoint to check limit before generation:

```typescript
const limitCheck = await checkGenerateRecipeLimit(user.id);
if (!limitCheck.allowed) {
  return NextResponse.json({ error: "Limit reached", ... }, { status: 429 });
}
```

### Pro Users (Future)

To implement unlimited usage for pro users, update check functions:

```typescript
export async function checkMealPlanLimit(
  userId: string
): Promise<UsageLimitCheck> {
  // Check if user is pro
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPro: true },
  });

  if (user?.isPro) {
    return {
      allowed: true,
      limit: Infinity,
      used: 0,
      remaining: Infinity,
      resetsAt: null,
    };
  }

  // ... existing limit check logic
}
```

## Analytics

### Usage Statistics

The `getAiUsageStats()` function returns comprehensive usage across all endpoints:

```typescript
{
  mealPlan: {
    count: 3,
    limit: 8,
    remaining: 5,
    resetsAt: "2025-11-27T12:34:56Z"
  },
  allEndpoints: {
    "meal-plan": 3,
    "generate-recipe": 12,
    "chat-instruction": 5,
    // ... etc
  }
}
```

This data can be used for:

- User dashboard displays
- Admin analytics
- Future pricing decisions
- Understanding feature usage patterns

## Testing

### Test Limit Enforcement

```bash
# Generate 8 meal plans
for i in {1..8}; do
  curl -X POST http://localhost:3000/api/ai/meal-plan \
    -H "Authorization: Bearer TOKEN" \
    -d '{"preferences": {...}}'
done

# 9th request should return 429
curl -X POST http://localhost:3000/api/ai/meal-plan \
  -H "Authorization: Bearer TOKEN" \
  -d '{"preferences": {...}}'
```

### Check Usage Stats

```bash
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer TOKEN"
```

## Performance Considerations

### Indexes

All necessary indexes are in place for efficient queries:

- `(userId, createdAt)` - User's usage timeline
- `(endpoint)` - Filter by endpoint type
- `(userId, endpoint, createdAt)` - Combined queries

### Caching (Future Enhancement)

Consider caching usage counts with Redis for high-traffic scenarios:

```typescript
// Check cache first
const cached = await redis.get(`usage:${userId}:meal-plan`);
if (cached) return JSON.parse(cached);

// Query database and cache result
const usage = await getMealPlanUsage(userId);
await redis.set(`usage:${userId}:meal-plan`, JSON.stringify(usage), "EX", 300);
```

## Migration Notes

- No existing data migration needed
- New tracking starts from deployment
- All users start with 0 usage in the last 30 days
- Historical usage before deployment is not tracked
