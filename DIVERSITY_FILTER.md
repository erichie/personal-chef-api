# Recipe Diversity Filter

## The Problem

When searching recipes by semantic similarity, you often get **multiple very similar recipes**:

```
Italian Beef and Penne Casserole
Italian Penne Pasta with Tomato Sauce
Italian Chicken Penne with Vegetables
Italian Penne with Beef and Tomatoes
```

All of these are "italian penne" variations, which makes meal plans repetitive and boring.

## The Solution

Added **smart diversity filtering** that automatically detects and filters out similar recipes.

### How It Works

The `selectDiverseRecipes()` function evaluates each recipe pair using two metrics:

#### 1. Title Similarity (60% threshold)

Compares the words in recipe titles:

```typescript
"Italian Beef Penne Casserole" vs "Italian Penne Pasta Tomato Sauce"
→ Both have: "italian", "penne" (2/5 words = 40% match) ✅ Different enough

"Italian Beef Penne" vs "Italian Penne with Beef"
→ Both have: "italian", "penne", "beef" (3/4 words = 75% match) ❌ Too similar
```

#### 2. Ingredient Overlap (70% threshold)

Compares the ingredients using canonical IDs or normalized names:

```typescript
Recipe A: [penne, beef, tomatoes, garlic, onions] (5 ingredients)
Recipe B: [penne, beef, tomatoes, basil, cheese] (5 ingredients)
→ Common: penne, beef, tomatoes (3/5 = 60% overlap) ✅ Different enough

Recipe A: [penne, beef, tomatoes, garlic, onions] (5 ingredients)
Recipe B: [penne, beef, tomatoes, garlic, basil] (5 ingredients)
→ Common: penne, beef, tomatoes, garlic (4/5 = 80% overlap) ❌ Too similar
```

### Algorithm

1. **Sort by similarity score** (highest first)
2. **Select greedily**:
   - Pick the best match
   - For each remaining candidate:
     - Compare to all already-selected recipes
     - If title similarity < 60% AND ingredient overlap < 70%: ✅ Select it
     - Otherwise: ⊘ Skip it
3. **Fallback**: If we can't find enough diverse recipes, fill with remaining candidates

### Example Output

```
✅ Top matches:
  1. Italian Beef and Penne Casserole (similarity: 0.566)
  2. Italian Penne Pasta with Tomato Sauce (similarity: 0.554)
  3. Italian Chicken Penne with Vegetables (similarity: 0.544)
  4. Mexican Beef Tacos (similarity: 0.543)
  5. Thai Basil Chicken (similarity: 0.538)

🎨 Applying diversity filter...
  ⊘ Skipping "Italian Penne Pasta with Tomato Sauce" - too similar to "Italian Beef and Penne Casserole" (75% title match)
  ⊘ Skipping "Italian Chicken Penne with Vegetables" - too similar to "Italian Beef and Penne Casserole" (75% title match)

✓ Selected 3 diverse recipes from database
  1. Italian Beef and Penne Casserole
  2. Mexican Beef Tacos
  3. Thai Basil Chicken
```

## Configuration

You can adjust the thresholds in `lib/ai-utils.ts`:

```typescript
dbRecipes = selectDiverseRecipes(candidates, targetDbRecipes, {
  titleSimilarityThreshold: 0.6, // 60% word overlap (default)
  ingredientOverlapThreshold: 0.7, // 70% ingredient match (default)
});
```

### Tuning Guidelines

**More variety** (stricter filtering):

```typescript
{
  titleSimilarityThreshold: 0.4,    // 40% - very strict
  ingredientOverlapThreshold: 0.5,  // 50% - very strict
}
```

**Allow similar recipes** (looser filtering):

```typescript
{
  titleSimilarityThreshold: 0.8,    // 80% - very loose
  ingredientOverlapThreshold: 0.9,  // 90% - very loose
}
```

## Benefits

✅ **No duplicate penne pasta recipes** in the same meal plan  
✅ **More cuisine variety** - won't get 5 Italian dishes  
✅ **Better user experience** - each recipe feels distinct  
✅ **Still uses semantic search** - finds relevant recipes first, then diversifies  
✅ **Graceful degradation** - if not enough diverse recipes, fills with what's available

## Technical Details

**Location**: `lib/recipe-search-utils.ts` → `selectDiverseRecipes()`

**Used by**:

- `generateHybridMealPlan()` - main meal plan generation
- Can be used by any function that needs to select diverse recipes

**Performance**: O(n²) where n = number of candidates, but n is small (typically 15-30)

**Dependencies**:

- `calculateTitleSimilarity()` - word-based title comparison
- `calculateIngredientOverlapPercent()` - ingredient set comparison

## Testing

Generate a meal plan with Italian preferences and check that you don't get multiple "penne pasta" recipes:

```bash
# Should see diversity filtering in action
# Watch for "⊘ Skipping..." messages in the logs
```

## Future Enhancements

- **Cuisine diversity**: Ensure mix of cuisines (not all Italian)
- **Protein diversity**: Vary protein sources (chicken, beef, fish, vegetarian)
- **Cooking method diversity**: Mix of baking, stir-fry, slow-cook, etc.
- **ML-based similarity**: Use embeddings to detect semantic similarity beyond words
