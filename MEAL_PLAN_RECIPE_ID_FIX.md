# Meal Plan Recipe ID Fix - Mobile App Action Required

## Issue

When creating meal plans via `POST /api/meal-plans`, the mobile app was sending **empty strings** for `recipeId` fields instead of actual recipe IDs. This caused:

1. ❌ The `recipes` array in responses was empty
2. ❌ Recipients couldn't save meal plans (no recipe data)
3. ❌ Feed posts of meal plans had no recipe information

## Root Cause

The mobile app was sending meal plan data like this:

```json
{
  "title": "My Week",
  "days": [
    {
      "dayNumber": 0,
      "meals": {
        "dinner": {
          "title": "Chicken Stir Fry",
          "recipeId": "", // ❌ EMPTY STRING
          "description": "...",
          "servings": 4
        }
      }
    }
  ]
}
```

## Fix Required

The mobile app **MUST** send the actual `recipeId` when creating meal plans:

```json
{
  "title": "My Week",
  "days": [
    {
      "dayNumber": 0,
      "meals": {
        "dinner": {
          "title": "Chicken Stir Fry",
          "recipeId": "uuid-of-recipe", // ✅ ACTUAL RECIPE ID
          "description": "...",
          "servings": 4
        }
      }
    }
  ]
}
```

## Backend Changes

1. ✅ Added validation to reject meal plans with empty `recipeId` fields
2. ✅ Returns clear error message: `"Missing recipeId for dinner on day 0. Recipe: 'Chicken Stir Fry'"`
3. ✅ Backfilled existing meal plans where possible (matched by title)

## Mobile App Action Items

### 1. Update Meal Plan Creation

When extracting a meal plan from `UserProfile.mealPlans` to create a shareable template:

```typescript
// ❌ WRONG - Don't do this
const template = {
  title: "My Week",
  days: userWeek.days.map((day, index) => ({
    dayNumber: index,
    meals: {
      dinner: {
        recipeId: "", // ❌ Empty string
        title: day.meals.dinner.title,
        // ...
      },
    },
  })),
};

// ✅ CORRECT - Include the actual recipe ID
const template = {
  title: "My Week",
  days: userWeek.days.map((day, index) => ({
    dayNumber: index,
    meals: {
      dinner: day.meals.dinner
        ? {
            recipeId: day.meals.dinner.recipeId, // ✅ Actual ID
            title: day.meals.dinner.title,
            description: day.meals.dinner.description,
            servings: day.meals.dinner.servings,
            totalMinutes: day.meals.dinner.totalMinutes,
          }
        : undefined,
    },
  })),
};
```

### 2. Ensure UserProfile.mealPlans Has Recipe IDs

Make sure when users save recipes to their meal plans, the `recipeId` is stored:

```typescript
// When saving a recipe to a meal plan day
const updatedDay = {
  date: "2025-10-30",
  meals: {
    dinner: {
      recipeId: recipe.id, // ✅ Store the recipe ID
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      totalMinutes: recipe.totalMinutes,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      cooked: false,
      skipped: false,
    },
  },
};
```

## Testing

To verify the fix is working:

1. Create a meal plan from the mobile app
2. Check that the API returns a `recipes` array with full recipe data
3. Try sharing the meal plan - recipient should see all recipe details
4. Try viewing meal plan in feed - should have complete recipe information

## Example Correct Response

When you `GET /api/meal-plans/{id}` or `GET /api/meal-plan-shares`, you should receive:

```json
{
  "mealPlan": {
    "id": "uuid",
    "title": "My Week",
    "days": [
      {
        "dayNumber": 0,
        "meals": {
          "dinner": {
            "recipeId": "553b1011-48fb-49c2-8af1-932fb4e22ec2",
            "title": "Chicken Stir Fry"
          }
        }
      }
    ],
    "recipes": [
      {
        "id": "553b1011-48fb-49c2-8af1-932fb4e22ec2",
        "title": "Chicken Stir Fry",
        "ingredients": [
          /* full ingredient list */
        ],
        "steps": [
          /* full cooking steps */
        ]
      }
    ]
  }
}
```

## Error Handling

If you try to create a meal plan with empty `recipeId` fields, you'll now get:

```json
{
  "error": "Missing recipeId for dinner on day 0. Recipe: 'Chicken Stir Fry'",
  "code": "MISSING_RECIPE_ID"
}
```

Status Code: `400 Bad Request`

## Questions?

If you have questions about where to get the `recipeId` or how to structure the meal plan data, please ask!
