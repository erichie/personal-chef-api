# Token Validation Fix - Device-Managed Tokens

## Issue

Backend was rejecting token usage requests with "INSUFFICIENT_TOKENS" error even when mobile app sent the correct `tokensToUse` amount. This was because the backend was trying to validate the user's token balance from the database, but tokens are stored on the mobile device, not in the backend.

## Root Cause

All AI endpoints were calling `validateUserTokens()` which checks the user's token balance in the database (`UserProfile.tokenState`). Since tokens are managed on device, this validation always failed.

## Solution Implemented

### Changed Token Validation Strategy

Instead of validating the user's token balance in the database, we now:

1. ✅ Verify the mobile app is sending the correct token amount (matches `MEAL_PLAN_TOKEN_COST`)
2. ✅ Trust the mobile app to handle token deduction on their side
3. ✅ Skip database balance validation entirely

### Files Modified

#### 1. Meal Plan API

**File: `app/api/ai/meal-plan/route.ts` (lines 86-108)**

```typescript
// If tokens are provided, validate the amount (tokens are stored on device)
if (payload.tokensToUse !== undefined) {
  // Validate token amount is correct
  if (payload.tokensToUse !== MEAL_PLAN_TOKEN_COST) {
    return NextResponse.json(
      {
        error: "Invalid token amount",
        code: "INVALID_TOKEN_AMOUNT",
        details: {
          required: MEAL_PLAN_TOKEN_COST,
          provided: payload.tokensToUse,
        },
      },
      { status: 400 }
    );
  }

  // Token balance is managed on device, so we trust the mobile app
  // Just verify they're sending the correct amount
  usedTokens = true;
  console.log(
    `User ${user.id} using ${MEAL_PLAN_TOKEN_COST} tokens for meal plan (device-managed)`
  );
}
```

- Removed `validateUserTokens()` call
- Removed import of `validateUserTokens`
- Added comment explaining device-managed tokens

#### 2. Generate Recipe API

**File: `app/api/ai/generate-recipe/route.ts` (lines 87-106)**

- Removed `validateUserTokens()` call
- Removed import of `validateUserTokens`
- Same validation logic as meal plan API

#### 3. Replace Recipe API

**File: `app/api/ai/replace-recipe/route.ts` (lines 41-59)**

- Removed `validateUserTokens()` call
- Removed import of `validateUserTokens`
- Same validation logic as meal plan API

#### 4. Parse Recipe API

**File: `app/api/ai/parse-recipe/route.ts` (lines 31-49)**

- Removed `validateUserTokens()` call
- Removed import of `validateUserTokens`
- Same validation logic as meal plan API

## How It Works Now

### Without Tokens (Free Tier)

```typescript
// Mobile app doesn't send tokensToUse
{
  "prompt": "pasta carbonara"
}
```

Backend checks usage limits and rejects if exceeded.

### With Tokens (Bypass Limits)

```typescript
// Mobile app sends tokensToUse with correct amount
{
  "prompt": "pasta carbonara",
  "tokensToUse": 100  // Must match MEAL_PLAN_TOKEN_COST
}
```

Backend:

1. Verifies amount matches required cost (100 tokens)
2. Allows the request (skips limit checks)
3. Returns `usedTokens: true` and `tokensUsed: 100`
4. Mobile app deducts tokens from device storage

## Error Responses

### Invalid Token Amount

```json
{
  "error": "Invalid token amount",
  "code": "INVALID_TOKEN_AMOUNT",
  "details": {
    "required": 100,
    "provided": 50
  }
}
```

Status: 400 Bad Request

### No Tokens (Limit Exceeded)

```json
{
  "error": "Meal plan generation limit reached",
  "code": "LIMIT_EXCEEDED",
  "details": {
    "limit": 2,
    "used": 2,
    "remaining": 0,
    "resetsAt": "2025-11-04T00:00:00Z",
    "tokenCost": 100
  }
}
```

Status: 429 Too Many Requests

## Future Migration to Backend Tokens

When you eventually move token storage to the backend:

1. Re-enable `validateUserTokens()` calls
2. Update to actually check and deduct from database
3. Keep the same API contract (mobile app still sends `tokensToUse`)
4. Backend becomes source of truth instead of device

## Testing

Test with tokens:

```bash
curl -X POST http://localhost:3000/api/ai/meal-plan \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tokensToUse": 100,
    "numRecipes": 10,
    "preferences": {
      "startDate": "2025-11-03",
      "endDate": "2025-11-12"
    }
  }'
```

Expected response:

```json
{
  "mealPlan": { ... },
  "usedTokens": true,
  "tokensUsed": 100,
  "message": "Meal plan generated successfully using tokens"
}
```

## Related Files

- `lib/ai-usage-utils.ts` - Contains `validateUserTokens()` (currently unused)
- `MEAL_PLAN_TOKEN_COST` - Set to 100 tokens per AI call

## Summary

✅ Token validation now works with device-managed tokens
✅ Mobile app can bypass limits by sending correct token amount
✅ Backend trusts mobile app to handle token deduction
✅ All 4 AI endpoints updated consistently
