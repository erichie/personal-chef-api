# Null Values in Meal Plan Ingredients - Fixed

## Issue

When meal plans were generated (especially when pulling recipes from the database), the frontend validation was failing with errors like:

```
Invalid input: expected string, received null
Invalid input: expected number, received null
```

Error path: `days[X].meals.dinner.ingredients[Y].qty`

## Root Cause

**Database Storage:**

- PostgreSQL stores missing values as `null`
- Recipe ingredients in the database have fields like `qty: null`, `unit: null`, `notes: null`

**Frontend Validation:**

- Zod schemas with `.optional()` accept `undefined` OR a value
- `.optional()` does NOT accept `null`
- When `null` is serialized to JSON, it remains `null` (not converted to `undefined`)

**The Problem:**

```typescript
// Database returns:
{ name: "salt", qty: null, unit: null }

// Frontend expects:
{ name: "salt" } // or { name: "salt", qty: 1, unit: "tsp" }
// NOT: { name: "salt", qty: null, unit: null }
```

## Solution Implemented

### 1. Added Sanitization Function (`app/api/ai/meal-plan/route.ts`)

```typescript
/**
 * Sanitize meal plan data to convert null values to undefined
 * This prevents validation errors on the frontend
 */
function sanitizeMealPlan(mealPlan: any): any {
  if (!mealPlan || typeof mealPlan !== "object") return mealPlan;

  // Deep clone to avoid mutating original
  const sanitized = JSON.parse(
    JSON.stringify(mealPlan, (key, value) => {
      // Convert null to undefined (undefined values will be omitted in JSON)
      return value === null ? undefined : value;
    })
  );

  return sanitized;
}
```

**How it works:**

- Uses JSON serialization replacer function
- Converts all `null` values to `undefined`
- When JSON stringifies the result, `undefined` values are omitted
- Frontend receives clean data without `null` values

### 2. Applied Sanitization Before Response

```typescript
// Sanitize meal plan data to remove null values (convert to undefined)
const sanitizedMealPlan = sanitizeMealPlan(mealPlanData);

return NextResponse.json({
  mealPlan: sanitizedMealPlan,
  // ... other fields
});
```

### 3. Updated Validation Schemas (Defense in Depth)

Also updated validation schemas in other endpoints to accept nullable values:

**`app/api/ai/generate-recipe/route.ts`:**

```typescript
qty: z.union([z.number(), z.string()]).nullable().optional(),
unit: z.string().nullable().optional(),
notes: z.string().nullable().optional(),
```

**`app/api/ai/generate-steps/route.ts`:**

```typescript
qty: z.union([z.number(), z.string()]).nullable().optional(),
unit: z.string().nullable().optional(),
notes: z.string().nullable().optional(),
```

## Why This Happens with Hybrid Meal Plans

The hybrid meal plan system pulls recipes from the database, which may have been:

1. Created from previous meal plans
2. Parsed from URLs
3. Manually entered

All of these can result in ingredients with `null` values for optional fields like `qty`, `unit`, and `notes`.

## Result

### Before:

```json
{
  "ingredients": [{ "name": "salt", "qty": null, "unit": null }]
}
// ❌ Frontend validation error
```

### After:

```json
{
  "ingredients": [{ "name": "salt" }]
}
// ✅ Frontend validation passes
```

## Files Modified

1. **`app/api/ai/meal-plan/route.ts`**

   - Added `sanitizeMealPlan()` function
   - Applied sanitization before returning response

2. **`app/api/ai/generate-recipe/route.ts`**

   - Updated Zod schemas to accept `.nullable().optional()`

3. **`app/api/ai/generate-steps/route.ts`**
   - Updated Zod schemas to accept `.nullable().optional()`

## Testing

The fix handles:

- ✅ Ingredients with `qty: null` → becomes `{ name: "..." }` (qty omitted)
- ✅ Ingredients with `unit: null` → becomes `{ name: "..." }` (unit omitted)
- ✅ Ingredients with `notes: null` → becomes `{ name: "..." }` (notes omitted)
- ✅ Nested objects and arrays (deep sanitization)
- ✅ Preserves valid values (numbers, strings, booleans)

## Alternative Solutions Considered

1. **Update database schema** - Would require migration and could break existing data
2. **Update frontend validation** - Would require changes across multiple schemas
3. **Transform at Prisma layer** - Complex and would need to be applied everywhere
4. **✅ Sanitize at API response** - Clean, centralized, backward compatible (chosen solution)

## Status

✅ **FIXED** - Meal plans now return clean data without null values that cause frontend validation errors.

---

**Fix Date**: October 27, 2025  
**Status**: Complete and tested
