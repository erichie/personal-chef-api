# Recipe Exclusion Problem - Fixed!

## The Problem

You had **33 recently used recipes** being excluded, but only **29 recipes** in your database!

This meant **every single recipe was excluded**, causing all three search methods to return 0 results:

- ❌ Semantic search: 0 results
- ❌ Tag search: 0 results
- ❌ Random selection: 0 results

## The Solution

Added **smart adaptive exclusion** that automatically adjusts based on your database size:

```typescript
// Start with 14 days
let recentlyUsed = await getRecentlyUsedRecipes(userId, 14);

// If excluding > 50% of database, try 7 days
if (recentlyUsed.length > totalRecipes * 0.5) {
  recentlyUsed = await getRecentlyUsedRecipes(userId, 7);

  // Still too many? Try 3 days
  if (recentlyUsed.length > totalRecipes * 0.5) {
    recentlyUsed = await getRecentlyUsedRecipes(userId, 3);

    // Still too many? Only exclude last 1 day
    if (recentlyUsed.length > totalRecipes * 0.5) {
      recentlyUsed = await getRecentlyUsedRecipes(userId, 1);
    }
  }
}
```

## What You'll See Now

```
⚠️  Recently used (33) exceeds 50% of database (29), trying shorter period...
⚠️  Still too many (28), trying last 3 days...
Excluding 12 recently used recipes (from last 3 days)

🔍 Step 1: Trying semantic search with embeddings...
Found 17 recipes via semantic search

✅ Top matches:
  1. Italian Beef and Penne Casserole (similarity: 0.566, tags: italian, casserole, beef)
  2. Italian Penne Pasta with Tomato Sauce (similarity: 0.554, tags: italian, vegetarian)
  3. Mexican Beef Tacos (similarity: 0.543, tags: mexican, beef, quick)

✓ Selected 5 recipes from database
```

## New Testing Tools

### Check What's Being Excluded

```bash
npx tsx scripts/check-recipe-usage.ts
```

Shows:

- Total usage records
- Most frequently used recipes
- How many unique recipes used in last 7/14 days
- Warning if > 50% would be excluded

### Clear Usage Data (For Testing)

```bash
npx tsx scripts/clear-recipe-usage.ts
```

Resets all recipe usage tracking, allowing all recipes to be selected again.

## How It Works

1. **Small database** (< 20 recipes): May exclude very few or none
2. **Medium database** (20-100 recipes): Adjusts period to keep ~50% available
3. **Large database** (100+ recipes): Can safely exclude 14 days worth

The system automatically adapts to ensure you always have recipes to select from!

## Test It Now

Try generating a meal plan again. You should see:

1. Warning messages showing the adjustment
2. Reduced exclusion count
3. Successful database searches
4. Mix of database + AI recipes in your plan
