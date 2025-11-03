# Cuisine Field API Response Fix

## Issue

Mobile app reported ZodError when calling the replace recipe endpoint:

```
{
  "expected": "string",
  "code": "invalid_type",
  "path": ["cuisine"],
  "message": "Invalid input: expected string, received undefined"
},
{
  "expected": "array",
  "code": "invalid_type",
  "path": ["steps"],
  "message": "Invalid input: expected array, received null"
}
```

## Root Cause

When we added the `cuisine` field to the database schema, we forgot to include it in the API response objects. The mobile app's `RecipeSchema` expects:

1. `cuisine` to be a required string field
2. `steps` to be an array (not null)

## Solution Implemented

### 1. Fixed All Recipe API Responses ✅

Added `cuisine` field and `steps || []` to all recipe endpoints:

#### A. Replace Recipe API

**File: `app/api/ai/replace-recipe/route.ts` (line 170, 173)**

```typescript
cuisine: recipe.cuisine,
steps: recipe.steps || [],
```

#### B. Generate Recipe API

**File: `app/api/ai/generate-recipe/route.ts` (line 247, 250, 399, 402)**

```typescript
cuisine: dbRecipe.cuisine,  // For database recipes
steps: dbRecipe.steps || [],

cuisine: recipe.cuisine || "Other",  // For AI-generated recipes
steps: recipe.steps || [],
```

#### C. Parse Recipe API

**File: `app/api/ai/parse-recipe/route.ts` (line 122, 125)**

```typescript
cuisine: recipe.cuisine,
steps: recipe.steps || [],
```

### 2. Fixed Recipe Discovery API ✅

**File: `app/api/recipes/discover/route.ts`**

Updated raw SQL queries to include `cuisine` field:

- Added `cuisine` to Recipe interface (line 18)
- Added `r.cuisine` to SELECT statements (lines 57, 90)
- Added `r.cuisine` to GROUP BY clauses (lines 75, 107)

### 3. Fixed Recipe Search Utilities ✅

**File: `lib/recipe-search-utils.ts`**

Updated `RecipeWithSimilarity` interface and all SQL queries:

- Added `cuisine: string` to interface (line 18)
- Updated 4 raw SQL queries to include cuisine:
  1. `searchRecipesByPreferences` (line 105)
  2. `searchRecipesByTags` (line 587)
  3. `getRandomRecipes` (line 635)
  4. `searchRecipeByQuery` (line 698)

## Files Modified

1. ✅ `app/api/ai/replace-recipe/route.ts` - Added cuisine and fixed steps
2. ✅ `app/api/ai/generate-recipe/route.ts` - Added cuisine and fixed steps
3. ✅ `app/api/ai/parse-recipe/route.ts` - Added cuisine and fixed steps
4. ✅ `app/api/recipes/discover/route.ts` - Added cuisine to SQL queries
5. ✅ `lib/recipe-search-utils.ts` - Added cuisine to interface and all SQL queries

## Testing

Mobile app should now successfully:

1. ✅ Receive `cuisine` field (string) in all recipe responses
2. ✅ Receive `steps` as an array (empty array if no steps)
3. ✅ Parse recipes without ZodError

## Verification Commands

Test each endpoint:

```bash
# Replace recipe
curl -X POST http://localhost:3000/api/ai/replace-recipe \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"originalRecipe": {"title": "Test"}, "replacementReason": "test"}'

# Generate recipe
curl -X POST http://localhost:3000/api/ai/generate-recipe \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"prompt": "pasta carbonara"}'

# Parse recipe
curl -X POST http://localhost:3000/api/ai/parse-recipe \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"url": "https://example.com/recipe"}'

# Discover recipes
curl http://localhost:3000/api/recipes/discover?count=5
```

All responses should include:

- `cuisine`: string (e.g., "Italian", "Other")
- `steps`: array (empty array [] if null)

## Related Documentation

- `CUISINE_FIELD_IMPLEMENTATION.md` - Original cuisine field implementation
- `DUPLICATE_RECIPE_FIX.md` - Duplicate recipe detection fix
