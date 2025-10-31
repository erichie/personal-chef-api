# Recipe Sharing Update - Share Any Recipe

## What Changed

Recipe sharing now supports **two modes**:

### 1. Share by ID (Original)

Share an existing recipe you own:

```
POST /api/recipes/{recipeId}/share
```

### 2. Share by Data (New) ⭐

Share any recipe by providing full recipe data:

```
POST /api/recipe-shares
```

## Why This Matters

**Before**: You could only share recipes that already existed in your recipe collection.

**Now**: You can share recipes from anywhere:

- Recipes from meal plans (that may not be in your recipe collection)
- Recipes from external sources
- Recipes you just cooked that aren't saved yet
- Any recipe data, even if it's not in the database

## How It Works

When you share by data:

1. **Backend checks** if you already have a recipe with that title
2. **If found**: Uses the existing recipe (avoids duplicates)
3. **If not found**: Creates a new recipe in your account automatically
4. **Then shares** the recipe with your friend

This means:

- ✅ No duplicate recipes
- ✅ Share from anywhere
- ✅ Recipes automatically saved to your collection
- ✅ Friend gets full recipe data immediately

## Mobile Implementation

### Option 1: Share Existing Recipe

```typescript
POST /api/recipes/{recipeId}/share
{
  "recipientId": "friend-uuid",
  "message": "Check this out!" // optional
}
```

### Option 2: Share Any Recipe (NEW)

```typescript
POST /api/recipe-shares
{
  "recipientId": "friend-uuid",
  "message": "Check this out!", // optional
  "recipe": {
    "title": "Chicken Stir Fry",
    "description": "Quick and delicious",
    "servings": 4,
    "totalMinutes": 30,
    "tags": ["dinner", "quick"],
    "ingredients": [
      {
        "name": "chicken breast",
        "qty": 1,
        "unit": "lb",
        "canonicalId": "chicken breast"
      },
      {
        "name": "soy sauce",
        "qty": 2,
        "unit": "tbsp",
        "canonicalId": "soy sauce"
      }
    ],
    "steps": [
      {
        "order": 1,
        "text": "Cut chicken into bite-sized pieces"
      },
      {
        "order": 2,
        "text": "Heat oil in wok over high heat"
      }
    ],
    "source": "meal-plan" // or "external", "cooked", etc.
  }
}
```

### Alternative: Use recipeId in POST /api/recipe-shares

You can also use the new endpoint with just a `recipeId`:

```typescript
POST /api/recipe-shares
{
  "recipientId": "friend-uuid",
  "recipeId": "existing-recipe-uuid",
  "message": "Check this out!"
}
```

## Use Cases

### 1. Sharing from Meal Plans

When viewing a friend's meal plan post:

```typescript
// Extract recipe from meal plan
const recipe = mealPlan.days[0].meals.dinner;

// Share it directly
POST /api/recipe-shares
{
  "recipientId": friendId,
  "recipe": {
    "title": recipe.title,
    "description": recipe.description,
    "ingredients": recipe.ingredients,
    "steps": recipe.steps,
    // ... other fields
  }
}
```

### 2. Sharing from Feed

When viewing a recipe post:

```typescript
// You have the full recipe data
const recipe = post.recipe;

// Share it
POST /api/recipe-shares
{
  "recipientId": friendId,
  "recipe": recipe
}
```

### 3. Sharing After Cooking

Just finished cooking something:

```typescript
// Share what you just made
POST /api/recipe-shares
{
  "recipientId": friendId,
  "recipe": {
    "title": "My Amazing Stir Fry",
    "ingredients": [...],
    "steps": [...],
    "source": "cooked-today"
  }
}
```

## Benefits

1. **Simpler UX**: Share button works anywhere, no need to check if recipe exists first
2. **No Duplicates**: Backend handles deduplication automatically
3. **Automatic Saving**: Recipes get added to sender's collection automatically
4. **Full Data**: Friend always gets complete recipe with ingredients and steps
5. **Flexible**: Works with recipes from any source

## Backend Implementation

The backend handles:

- ✅ Validation (title + ingredients required)
- ✅ Duplicate checking (by title + userId)
- ✅ Auto-creation of new recipes
- ✅ Friendship validation
- ✅ Share tracking

## See Also

- **Full API Documentation**: `RECIPE_SHARING_API.md`
- **Meal Plan Sharing**: `MEAL_PLAN_SHARING_MOBILE_API.md`
