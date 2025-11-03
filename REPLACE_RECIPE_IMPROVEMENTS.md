# Replace Recipe Improvements

## Issues Fixed

1. **Descriptions too long** - Recipe descriptions were verbose and detailed
2. **Unnecessary steps** - Replace recipe was generating steps (should be fetched separately)
3. **No cuisine awareness** - Not detecting when user wants "something different" vs similar cuisine

## Changes Made

### 1. Shortened Descriptions ✅

**File: `lib/ai-utils.ts` - REPLACE_RECIPE_SYSTEM_PROMPT (line 101)**

Added explicit instruction:

```
9. Keep descriptions SHORT (1-2 sentences maximum)
```

Updated JSON format specification:

```
- description (1-2 sentences ONLY - brief and concise)
```

**Before:**

```
"description": "A classic Italian pasta dish featuring creamy carbonara sauce made with eggs,
Parmesan cheese, and crispy pancetta. This authentic Roman recipe combines simple ingredients
to create a rich and flavorful meal that's perfect for any occasion. The key is to toss the
hot pasta with the egg mixture off heat to create a silky sauce without scrambling the eggs."
```

**After:**

```
"description": "Classic Roman pasta with creamy egg and cheese sauce, topped with crispy pancetta.
A rich and indulgent dinner ready in 25 minutes."
```

### 2. Removed Steps ✅

**File: `lib/ai-utils.ts` - REPLACE_RECIPE_SYSTEM_PROMPT (line 117)**

Added clear instruction:

```
DO NOT include steps - they will be generated separately.
```

Removed steps from the return format specification (was: "steps array with order and text").

**Why:**

- Steps should be fetched separately via the generate-steps endpoint
- Reduces AI response size and cost
- Keeps replacement responses lightweight

### 3. Cuisine Awareness ✅

**File: `lib/ai-utils.ts` - generateHybridReplacement (lines 889-892)**

Added detection for "something different":

```typescript
// Check if user wants something truly different (different cuisine)
const wantsDifferentCuisine = /different|variety|change|new|else/i.test(
  request.replacementReason
);
```

Updated AI prompt (line 94):

```
2. If the reason suggests "something different" or "variety", suggest a DIFFERENT cuisine type
```

**How it works:**

1. **Detects keywords** - Checks replacement reason for: "different", "variety", "change", "new", "else"
2. **Informs AI** - AI knows to suggest a different cuisine when these keywords are present
3. **Logs intent** - Console shows when user wants different cuisine

**Examples:**

| Replacement Reason    | Detection            | AI Behavior                                            |
| --------------------- | -------------------- | ------------------------------------------------------ |
| "something different" | ✅ Different cuisine | Suggests completely different cuisine (Italian → Thai) |
| "want variety"        | ✅ Different cuisine | Suggests different type of dish                        |
| "need something else" | ✅ Different cuisine | Avoids same cuisine                                    |
| "less spicy"          | ❌ Same cuisine OK   | Can suggest same cuisine, just less spicy              |
| "vegetarian version"  | ❌ Same cuisine OK   | Can keep same cuisine, make vegetarian                 |

**Console Output:**

```
Found 10 candidates, 7 after excluding original and similar recipes (user wants different cuisine)
```

## Combined Benefits

### Before

```json
{
  "title": "Chicken Fajitas",
  "description": "A vibrant and flavorful Mexican dish featuring tender strips of marinated chicken...",
  "cuisine": "Mexican",
  "ingredients": [...],
  "steps": [
    { "order": 1, "text": "Marinate the chicken..." },
    { "order": 2, "text": "Heat oil in pan..." },
    ...
  ]
}
```

### After (when user says "something different")

```json
{
  "title": "Pad Thai",
  "description": "Classic Thai stir-fried noodles with tangy tamarind sauce and peanuts.",
  "cuisine": "Thai",
  "ingredients": [...],
  "steps": null  // Fetched separately
}
```

## Prompt Changes Summary

**REPLACE_RECIPE_SYSTEM_PROMPT Updates:**

| Line | Change                        | Impact                                          |
| ---- | ----------------------------- | ----------------------------------------------- |
| 94   | Added cuisine awareness rule  | AI suggests different cuisines when appropriate |
| 101  | Added description length rule | Keeps descriptions to 1-2 sentences             |
| 105  | Updated description format    | Reinforces brevity requirement                  |
| 117  | Added "DO NOT include steps"  | Removes unnecessary step generation             |

## Testing

Test with "something different":

```bash
curl -X POST http://localhost:3000/api/ai/replace-recipe \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "originalRecipe": {
      "title": "Chicken Fajitas"
    },
    "replacementReason": "something different"
  }'
```

Expected response:

- ✅ Description is 1-2 sentences
- ✅ No steps included (null or empty)
- ✅ Different cuisine (not Mexican if original was Mexican)

Test with specific modification:

```bash
curl -X POST http://localhost:3000/api/ai/replace-recipe \
  -d '{
    "originalRecipe": {
      "title": "Chicken Parmesan"
    },
    "replacementReason": "vegetarian version"
  }'
```

Expected response:

- ✅ Short description
- ✅ No steps
- ✅ Same cuisine OK (Italian → Italian vegetarian is fine)

## Related Files

- `lib/ai-utils.ts` - Updated prompt and detection logic
- `app/api/ai/replace-recipe/route.ts` - Already handles missing steps correctly

## Summary

✅ Descriptions now limited to 1-2 sentences
✅ Steps no longer generated (fetched separately)
✅ AI detects when user wants different cuisine type
✅ Better variety in replacements when requested
