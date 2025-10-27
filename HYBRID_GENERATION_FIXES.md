# Hybrid Meal Plan Generation - Fixes Applied

## Issues Fixed

### 1. JSON Truncation Error ❌ → ✅

**Problem**: AI response was being cut off mid-JSON, causing parse errors.

**Root Cause**: `max_tokens: 4096` was too small for 10 recipes with full grocery lists.

**Solution**: Increased to `max_tokens: 16000` in `lib/ai-utils.ts`.

---

### 2. No Database Recipe Matches ❌ → ✅

**Problem**: Despite having 29 recipes with embeddings, semantic search found 0-1 matches with low similarity scores (0.313).

**Root Cause**: Preference embedding included abstract concepts that don't match recipe text:

```
❌ Before: "omnivore diet. Goals: USE_WHAT_I_HAVE, EAT_HEALTHIER, TRY_NEW_RECIPES. Loves italian, mexican, japanese..."
```

Recipes have concrete text like:

```
"Mexican Beef and Avocado Salad (tags: mexican, salad, beef)"
"Italian Penne Pasta with Chickpeas (tags: italian, pasta, vegetarian)"
```

**Solution**: Rewrote `generatePreferencesEmbedding()` in `lib/embedding-utils.ts` to:

- Repeat each loved cuisine multiple times for higher weight ("italian recipe. italian dish. mexican recipe. mexican dish...")
- Skip abstract goals ("USE_WHAT_I_HAVE", "TRY_NEW_RECIPES") that don't appear in recipe text
- Use recipe-like language ("quick dinner recipe" instead of "prefers quick 45 minute meals")
- Skip "omnivore" diet as it's the default

```
✅ After: "italian recipe. italian dish. mexican recipe. mexican dish. japanese recipe. japanese dish. thai recipe. thai dish. korean recipe. korean dish. quick dinner recipe. easy meal"
```

---

### 3. TypeScript/Linter Errors ❌ → ✅

**Fixed**:

- Exported `RecipeWithSimilarity` interface from `recipe-search-utils.ts`
- Replaced all `any` types with proper types (`RecipeWithSimilarity`, `MealPlanStructure`, `MealPlanDay`)
- Removed unused variables (`existingIngredientSets`, `exclusionPrompt`, `generateReplacementEmbedding`)
- Fixed duplicate `finalRecipes` assignment
- Added proper imports

---

## New Debugging Tools

### Check Recipe Stats

Run this anytime to see your recipe database status:

```bash
npx tsx scripts/check-recipe-stats.ts
```

Shows:

- Total recipes
- Recipes with embeddings
- Sample recipes with their tags/source
- Breakdown by source (ai, meal-plan, etc.)

### Automatic Logging

Meal plan generation now logs:

```
Database has 29 total recipes, 29 with embeddings
Preference embedding text: italian recipe. italian dish. mexican recipe...
Found 15 candidate recipes from database (similarity >= 0.3)
Top matches:
  1. Italian Penne Pasta (similarity: 0.856)
  2. Mexican Beef Salad (similarity: 0.843)
  ...
```

---

## How Semantic Matching Works

**Key Insight**: Embeddings work best when search queries and target text use similar language.

### Good Match Example ✅

- **Recipe**: "Italian Penne Pasta with Chickpeas (tags: italian, pasta, vegetarian)"
- **Preference**: "italian recipe. italian dish. pasta meal"
- **Result**: High similarity (0.80+) because both use "italian" and "pasta"

### Poor Match Example ❌

- **Recipe**: "Italian Penne Pasta (tags: italian, pasta)"
- **Preference**: "Goals: USE_WHAT_I_HAVE, EAT_HEALTHIER"
- **Result**: Low similarity (0.30) because recipes don't contain abstract goal keywords

---

## Testing Checklist

1. ✅ Increased max_tokens to prevent truncation
2. ✅ Improved preference embedding for better matches
3. ✅ Fixed all TypeScript errors
4. ✅ Added recipe stats script
5. ✅ Added detailed logging

**Next Steps**:

1. Test meal plan generation with your current recipes
2. Check console logs for preference embedding text and match scores
3. If matches are still low, consider:
   - Adding richer descriptions to recipes
   - Adding more specific tags (cuisine, difficulty, cooking method)
   - Lowering minSimilarity threshold further (currently 0.3)
