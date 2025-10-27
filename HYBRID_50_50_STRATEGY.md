# Hybrid Meal Plan Generation - 50/50 Strategy

## Overview

The hybrid meal plan generation now uses a **50/50 split strategy**:

- **50% from database** (using smart search with fallbacks)
- **50% from AI generation**

This balances cost savings with variety and ensures we always have fresh recipes.

## Changes Implemented

### 1. 50/50 Split Strategy

**File**: `lib/ai-utils.ts`

- Changed from 65% database target to **exactly 50%**
- Accounts for cases where database doesn't have enough recipes
- Formula: `targetDbRecipes = Math.min(Math.floor(numRecipes / 2), totalRecipes)`

### 2. Three-Tier Search Fallback

**File**: `lib/recipe-search-utils.ts` & `lib/ai-utils.ts`

When searching the database for recipes, we now use a fallback strategy:

#### Tier 1: Semantic/Embedding Search (Best)

- Uses vector embeddings to find semantically similar recipes
- Matches by meaning, not just keywords
- Threshold: similarity >= 0.3

#### Tier 2: Tag-Based Search (Good)

- Searches recipe tags for cuisine keywords (italian, mexican, etc.)
- Falls back here if semantic search finds 0 results
- Uses SQL `ILIKE` for case-insensitive matching

#### Tier 3: Random Selection (Fallback)

- Randomly selects recipes from database
- Last resort if both semantic and tag searches fail
- Ensures we always get database recipes when available

### 3. Improved Preference Embedding

**File**: `lib/embedding-utils.ts`

Changed preference embedding to focus on **concrete, recipe-matchable text**:

```
❌ Before:
"omnivore diet. Goals: USE_WHAT_I_HAVE, EAT_HEALTHIER, TRY_NEW_RECIPES.
Loves italian, mexican, japanese..."

✅ After:
"italian recipe. italian dish. mexican recipe. mexican dish.
japanese recipe. japanese dish. quick dinner recipe. easy meal"
```

**Key improvements**:

- Repeat each cuisine multiple times for higher weight
- Use recipe-like language ("italian recipe" vs "loves italian cuisine")
- Skip abstract goals that don't appear in recipe text
- Skip "omnivore" diet (default)

### 4. Enhanced Debug Logging

The meal plan generation now shows detailed progress:

```
Target: 5 from DB, 5 from AI (total: 10)
Excluding 0 recently used recipes

🔍 Step 1: Trying semantic search with embeddings...
  - Search limit: 15
  - Min similarity: 0.3
  - Allergies: none
  - Exclusions: none
  - Max minutes: 45
Found 10 recipes via semantic search

✅ Top matches:
  1. Italian Beef and Penne Casserole (similarity: 0.566, tags: italian, casserole, beef)
  2. Italian Penne Pasta with Tomato Sauce (similarity: 0.554, tags: italian, vegetarian)
  3. Mexican Beef Tacos (similarity: 0.543, tags: mexican, beef, quick)

✓ Selected 5 recipes from database

🤖 Generating 5 recipes with AI...
```

## New Functions

### `searchRecipesByTags()`

**Location**: `lib/recipe-search-utils.ts`

Searches recipes by matching cuisine tags:

```typescript
const candidates = await searchRecipesByTags(
  [
    { cuisine: "ITALIAN", level: "LOVE" },
    { cuisine: "MEXICAN", level: "LIKE" },
  ],
  {
    limit: 10,
    excludeRecipeIds: ["id1", "id2"],
  }
);
```

### `getRandomRecipes()`

**Location**: `lib/recipe-search-utils.ts`

Gets random recipes from database:

```typescript
const recipes = await getRandomRecipes(5, {
  excludeRecipeIds: recentlyUsed,
});
```

## Smart Recipe Exclusion

**Problem**: If you're testing a lot, you might exclude all your recipes from recent usage!

**Solution**: The system now automatically adjusts the exclusion period:

1. **Start**: Try to exclude recipes from last 14 days
2. **If > 50% would be excluded**: Reduce to 7 days
3. **Still too many?**: Reduce to 3 days
4. **Still too many?**: Only exclude last 1 day

This ensures you always have recipes available in the database to select from.

**Example logs:**

```
⚠️  Recently used (33) exceeds 50% of database (29), trying shorter period...
⚠️  Still too many (28), trying last 3 days...
Excluding 12 recently used recipes (from last 3 days)
```

## Testing Tools

### Recipe Database Stats

Check your recipe count and embedding status:

```bash
npx tsx scripts/check-recipe-stats.ts
```

Output:

```
=== Recipe Database Stats ===

Total recipes: 29
Recipes with embeddings: 29
Recipes without embeddings: 0

Sample recipes with embeddings:
  1. Mexican Beef and Avocado Salad (source: ai, tags: mexican, salad, beef)
  2. Korean Gochujang Glazed Chicken (source: ai, tags: korean, chicken, rice)
  ...
```

### Check Recipe Usage

See which recipes are being excluded:

```bash
npx tsx scripts/check-recipe-usage.ts
```

Output:

```
=== Recipe Usage Report ===

Total usage records: 47
Most used recipes:
  Italian Beef and Penne Casserole: 5 times
  Mexican Beef Tacos: 4 times
  ...

Recipes used in last 7 days: 28
Unique recipes used in last 7 days: 25
Unique recipes used in last 14 days: 29

📊 Impact: 100.0% of database would be excluded (29/29 recipes)

⚠️  WARNING: More than 50% of recipes would be excluded!
   The smart exclusion logic will automatically reduce the exclusion period.
```

### Clear Recipe Usage (For Testing)

Reset recipe usage tracking:

```bash
npx tsx scripts/clear-recipe-usage.ts
```

This clears all usage records, allowing all recipes to be selected again.

### Test Semantic Search

Debug semantic search matching:

```bash
npx tsx scripts/test-semantic-search.ts
```

Output shows:

- Preference embedding text
- Manual similarity calculations
- Search function results
- Why recipes match or don't match

## Token Limit

**Max Tokens**: 4096 (GPT-4 Turbo limit)

This limits us to generating approximately 5-7 full recipes per AI call, which is perfect for our 50/50 strategy where we typically generate 5 recipes at a time for a 10-recipe meal plan.

## Cost Savings

With 50/50 split:

- **10 recipe meal plan**: 5 from DB (free), 5 from AI (~$0.25)
- **Full AI generation**: 10 recipes (~$0.50)
- **Savings**: ~50% per meal plan

As your recipe database grows, you get more variety without additional AI costs!

## Troubleshooting

### "Found 0 candidate recipes from database"

Check the debug logs for:

1. **Recently used recipes**: Are all your recipes excluded?
2. **Allergies/Exclusions**: Do your filters eliminate all recipes?
3. **Max minutes**: Is your time limit too strict?

Run the test script to verify semantic search is working:

```bash
npx tsx scripts/test-semantic-search.ts
```

### Semantic search finds recipes, but meal plan doesn't

Your actual preferences might have filters (allergies, exclusions, time limits) that eliminate all matches. Check the debug output for:

```
- Allergies: peanuts, shellfish
- Exclusions: dairy
- Max minutes: 30
```

If too many filters, the search will fall back to tag search or random selection.

## Example Flow

For a 10-recipe meal plan request:

1. **Phase 1: Database Search** (Target: 5 recipes)
   - Try semantic search with embeddings → finds 10 candidates
   - Sort by similarity, take top 5
2. **Phase 2: AI Generation** (Target: 5 recipes)
   - Generate 5 new recipes with AI
   - Store them in database with embeddings
3. **Phase 3: Combine**
   - Merge 5 DB + 5 AI = 10 total recipes
   - Build meal plan structure
   - Record recipe usage to avoid repetition

## Future Enhancements

- **Dynamic split**: Adjust ratio based on database size
- **Quality scoring**: Use AI to rate database matches before including
- **User feedback**: Learn which database recipes users like
- **Collaborative filtering**: "Users who liked X also liked Y"
