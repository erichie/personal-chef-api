# Replace Recipe Exclusion Fix

## Issue

When using the replace recipe endpoint with a reason like "something different", it was returning the exact same recipe from the database instead of finding a different recipe.

## Root Cause

The `generateHybridReplacement()` function in `lib/ai-utils.ts` was searching the database for replacement recipes but wasn't excluding the original recipe from the search results. This meant:

1. Search query: `"something different alternative to Chicken Parmesan"`
2. Database search finds recipes including the original "Chicken Parmesan"
3. Returns the original recipe as the "replacement"

## Solution Implemented

### File: `lib/ai-utils.ts` (lines 861-912)

**Changes:**

1. **Increased candidate limit** from 5 to 10

   - Since we'll filter out the original, we need more candidates

2. **Added title-based exclusion**

   ```typescript
   // Filter out the original recipe by title (case-insensitive)
   const originalTitleNormalized = request.originalRecipe.title
     .toLowerCase()
     .trim();
   let filtered = candidates.filter(
     (recipe) => recipe.title.toLowerCase().trim() !== originalTitleNormalized
   );
   ```

3. **Added logging**

   ```typescript
   console.log(
     `Found ${candidates.length} candidates, ${filtered.length} after excluding original recipe "${request.originalRecipe.title}"`
   );
   ```

4. **Reordered filtering logic**
   - First: Exclude original recipe by title
   - Then: Apply preference filters (time, allergies)

## How It Works Now

### Step 1: Database Search

Search for candidates using the replacement reason:

```
"something different alternative to Chicken Parmesan"
```

Returns up to 10 recipes from database.

### Step 2: Exclude Original

Filter out any recipe with the same title (case-insensitive):

```typescript
candidates = [
  { title: "Chicken Parmesan", ... },  // ❌ Excluded (original)
  { title: "Eggplant Parmesan", ... }, // ✅ Kept
  { title: "Chicken Piccata", ... },   // ✅ Kept
  { title: "Pasta Carbonara", ... },   // ✅ Kept
]
```

### Step 3: Apply Preferences

Filter by cooking time, allergies, etc.

### Step 4: Return or Generate

- If filtered results exist: Return first match from database
- If no matches: Generate new recipe with AI

## Edge Cases Handled

1. **Exact title match** - Filtered out (case-insensitive)
2. **Similar titles** - Kept (e.g., "Italian Chicken Parmesan" vs "Chicken Parmesan")
3. **No alternatives** - Falls back to AI generation
4. **All filtered out** - Falls back to AI generation

## Testing

Test the fix:

```bash
curl -X POST http://localhost:3000/api/ai/replace-recipe \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "originalRecipe": {
      "title": "Chicken Parmesan",
      "totalMinutes": 45
    },
    "replacementReason": "something different"
  }'
```

Expected behavior:

- Console logs show original recipe excluded
- Response includes a DIFFERENT recipe
- If no database match, generates with AI

## Console Output Example

```
Found 8 candidates, 7 after excluding original recipe "Chicken Parmesan"
Found suitable replacement from database: Eggplant Parmesan
```

Or if no matches:

```
Found 3 candidates, 2 after excluding original recipe "Chicken Parmesan"
No suitable replacement found in database, using AI
```

## Future Improvements

1. **Use recipe ID** - If mobile app provides original recipe ID, exclude by ID instead of title
2. **Similarity threshold** - Could also exclude very similar recipes (e.g., 90%+ ingredient overlap)
3. **Smarter search** - When reason is generic ("something different"), use broader search criteria

## Related Files

- `app/api/ai/replace-recipe/route.ts` - Calls `generateHybridReplacement()`
- `lib/recipe-search-utils.ts` - Provides `searchRecipeByQuery()`

## Summary

✅ Replace recipe now excludes original recipe from database search
✅ Increased candidate pool to account for filtering
✅ Added logging for debugging
✅ Falls back to AI generation if no alternatives found
