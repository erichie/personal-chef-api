# Duplicate Recipe Fix

## Issue

User reported receiving duplicate recipes in meal plans:

1. **Within same meal plan**: Same recipe appearing multiple times in a single meal plan
2. **Across meal plans**: Recipes repeating from previous meal plans

## Root Cause

Two features were temporarily disabled in the meal plan generation code:

1. **Duplicate Detection** (lines 700-719 in `lib/ai-utils.ts`)

   - Was disabled "for testing" to see if AI instructions alone were sufficient
   - Clearly not sufficient - AI generated duplicates despite instructions

2. **Recipe Exclusion** (lines 495-536 in `lib/ai-utils.ts`)
   - Still disabled (requires 100+ recipes in database)
   - Current database has only 37 recipes
   - Will remain disabled until database is more populated

## Solution Implemented

### 1. Re-enabled Duplicate Detection ✅

**File: `lib/ai-utils.ts` (lines 706-719)**

```typescript
// Deduplicate recipes within the same meal plan
const finalRecipes: RecipeWithSimilarity[] = [];
const seenTitles = new Set<string>();

for (const recipe of allRecipes) {
  const normalizedTitle = recipe.title.toLowerCase().trim();

  if (!seenTitles.has(normalizedTitle)) {
    finalRecipes.push(recipe);
    seenTitles.add(normalizedTitle);
  } else {
    console.log(`⚠️  Skipping duplicate recipe in meal plan: ${recipe.title}`);
  }
}
```

**How it works:**

- Tracks recipe titles in a Set (case-insensitive)
- Filters out any duplicate recipes before building the meal plan
- Logs when duplicates are detected for debugging

### 2. Re-enabled Regeneration Logic ✅

**File: `lib/ai-utils.ts` (lines 721-775)**

```typescript
// If we filtered out duplicates and don't have enough, generate more
if (finalRecipes.length < numRecipes) {
  const stillNeeded = numRecipes - finalRecipes.length;
  // Generate additional recipes to fill the gap
  // ... (generates more recipes and checks for duplicates)
}
```

**How it works:**

- If duplicates are filtered out, detects the shortfall
- Generates additional recipes to reach the requested count
- Also checks new recipes against existing titles to avoid duplicates

### 3. Enhanced AI Prompt ✅

**File: `lib/ai-utils.ts` (line 41)**

Added explicit instruction:

```
13. CRITICAL: Each recipe in the meal plan MUST be completely unique - no duplicate or repeated recipes within the same meal plan
```

**Why this helps:**

- Makes the requirement explicit to the AI
- Reduces likelihood of AI generating duplicates in first place
- Backup is the code-level duplicate detection

## What's Still Not Fixed

### Recipe Exclusion (Repeats Across Meal Plans)

**Status:** Still disabled

**Why:** Database only has 37 recipes. Excluding recently used recipes would severely limit variety.

**When to enable:** Once database has 100+ recipes, uncomment the exclusion logic at lines 495-536 in `lib/ai-utils.ts`

**What it will do when enabled:**

- Track recipes used in last 14 days
- Exclude them from future meal plans
- Dynamically reduce exclusion period if too many recipes are excluded (14 days → 7 days → 3 days → 1 day)

## Testing

To verify the fix works:

1. Generate a new meal plan
2. Check console logs for duplicate detection messages
3. Verify no duplicate recipes in the returned meal plan
4. All recipes should have unique titles

## Future Improvements

1. **Enable recipe exclusion** once database has 100+ recipes
2. **Semantic similarity detection** - detect recipes that are similar even with different titles (e.g., "Chicken Parmesan" vs "Parmesan Chicken")
3. **User preferences** - allow users to mark recipes as "don't repeat" or "favorite" (repeat more often)

## Files Modified

- ✅ `lib/ai-utils.ts` - Re-enabled duplicate detection and regeneration logic
- ✅ `lib/ai-utils.ts` - Enhanced AI prompt with explicit no-duplicates instruction

## Verification

Run a meal plan generation and check the logs for:

- `⚠️  Skipping duplicate recipe in meal plan: [Recipe Name]` - duplicate was caught
- `⚠️  Need X more recipes after deduplication, generating additional recipes...` - regeneration triggered
- `✓ Generated X additional recipes (total: Y)` - regeneration successful
