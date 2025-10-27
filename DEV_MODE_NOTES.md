# Development Mode Configuration

## Recipe Exclusion - DISABLED

**Location**: `lib/ai-utils.ts` (line ~453)

Recipe exclusion is currently **commented out** for development/testing.

### Why Disabled?

During development, you're generating many meal plans in a short time with a small database (29 recipes). This causes all recipes to be marked as "recently used", leaving nothing to select from.

### When to Re-enable

Uncomment the exclusion logic when:

- Your database has **100+ recipes**
- You're done with heavy testing
- You want to prevent recipe repetition in production

### How to Re-enable

In `lib/ai-utils.ts`, around line 453, uncomment this section:

```typescript
// CURRENTLY COMMENTED OUT:
// // Smart exclusion strategy: don't exclude more than 50% of database
// let recentlyUsed = await getRecentlyUsedRecipes(userId, 14);
// ...
```

And replace:

```typescript
const recentlyUsed: string[] = []; // Empty for now
console.log("📝 Recipe exclusion disabled (dev mode)");
```

With the uncommented exclusion logic.

### Current Behavior

- ✅ All recipes in database are available for selection
- ✅ Recipes can be repeated in meal plans
- ✅ Still records usage (for future when you re-enable)
- ⚠️ No variety control

### Testing

You can still track usage with:

```bash
# See what's being tracked
npx tsx scripts/check-recipe-usage.ts

# Clear usage data
npx tsx scripts/clear-recipe-usage.ts
```

## Expected Logs

With exclusion disabled, you should see:

```
Target: 5 from DB, 5 from AI (total: 10)
📝 Recipe exclusion disabled (dev mode)

🔍 Step 1: Trying semantic search with embeddings...
Found 10 recipes via semantic search

✅ Top matches:
  1. Italian Beef and Penne Casserole (similarity: 0.566)
  2. Italian Penne Pasta with Tomato Sauce (similarity: 0.554)
  ...

✓ Selected 5 recipes from database
🤖 Generating 5 recipes with AI...
```

All recipes are now available for selection!
