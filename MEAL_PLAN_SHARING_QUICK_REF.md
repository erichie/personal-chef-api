# Meal Plan Sharing - Quick Reference

## Quick Overview

Users can now:

- ✅ Post entire meal plans to their feed
- ✅ Share meal plans directly to friends
- ✅ Like and comment on meal plan posts
- ✅ Save friends' meal plans to their own weeks

## Key Concepts

**Meal Plan Template**: 7-day meal plan without specific dates (stored with dayNumber 0-6)
**Enriched Meal Plan**: Template + full recipe data (ingredients, steps, etc.)
**Meal Plan Post**: Public post of a meal plan in the feed
**Meal Plan Share**: Direct share to a specific friend

## Quick API Reference

### Create & Get Meal Plans

```bash
# Create template
POST /api/meal-plans
{
  "title": "My Week",
  "days": [{ "dayNumber": 0, "meals": {...} }, ...]  # 7 days
}

# Get with full recipe data
GET /api/meal-plans/{mealPlanId}
```

### Post to Feed

```bash
# Create post
POST /api/meal-plan-posts
{ "mealPlanId": "...", "text": "...", "rating": 5 }

# Get/Update/Delete
GET /api/meal-plan-posts/{postId}
PUT /api/meal-plan-posts/{postId}
DELETE /api/meal-plan-posts/{postId}

# Interactions
POST /api/meal-plan-posts/{postId}/like
POST /api/meal-plan-posts/{postId}/comment
DELETE /api/meal-plan-posts/{postId}/comment/{commentId}
```

### Direct Sharing

```bash
# Share to friend
POST /api/meal-plans/{mealPlanId}/share
{ "recipientId": "...", "message": "..." }

# View shares received
GET /api/meal-plan-shares?status=pending

# Update share status
PUT /api/meal-plan-shares/{shareId}
{ "status": "saved" }  # pending, viewed, saved, declined
```

### Feed Integration

```bash
# Feed automatically includes meal plan posts
GET /api/feed
GET /api/feed?type=meals  # only meal plan posts
```

## Data Structure

### Template Day Structure

```json
{
  "dayNumber": 0, // 0-6
  "meals": {
    "breakfast": {
      "recipeId": "uuid",
      "title": "Avocado Toast",
      "description": "...",
      "servings": 2,
      "totalMinutes": 10
    },
    "lunch": {
      /* optional */
    },
    "dinner": {
      /* optional */
    }
  }
}
```

### Enriched Response

All GET endpoints return meal plans enriched with full recipe data:

```json
{
  "mealPlan": {
    "id": "...",
    "title": "...",
    "days": [...],
    "recipes": [
      {
        "id": "...",
        "title": "...",
        "ingredients": [...],  // Full ingredient list
        "steps": [...],        // Full cooking steps
        "tags": [...]
      }
    ]
  }
}
```

## Mobile App Integration

### Posting a Meal Plan

1. Extract from `UserProfile.mealPlans`
2. Strip dates, tracking fields (cooked, skipped)
3. Convert to template (dayNumber 0-6)
4. `POST /api/meal-plans`
5. `POST /api/meal-plan-posts` (optional)

### Saving from Feed/Share

1. Get enriched meal plan (includes all recipe data)
2. User selects week to apply
3. Add specific dates
4. Initialize tracking (cooked: false, skipped: false)
5. Save to `UserProfile.mealPlans[weekId]`
6. If share: `PUT /api/meal-plan-shares/{id}` with status "saved"

## Database Tables

- **MealPlan**: Templates (7 days, no dates)
- **MealPlanPost**: Posts referencing meal plans
- **MealPlanPostLike**: Likes on posts
- **MealPlanPostComment**: Comments on posts
- **MealPlanShare**: Direct shares to friends
- **FeedActivity**: Updated to include `mealPlanPostId`

## Validation Rules

- Meal plans must have exactly 7 days (dayNumber 0-6)
- Rating: 1-5 (optional)
- Can only share with friends
- Can only post/share your own meal plans

## Common Patterns

### Check if user liked a meal plan post

```typescript
const isLiked = post.isLikedByCurrentUser;
```

### Filter feed for meal plan posts only

```typescript
GET /api/feed?type=meals
```

### Get pending meal plan shares

```typescript
GET /api/meal-plan-shares?status=pending
```

## Error Codes

- 400: Bad Request (validation)
- 401: Unauthorized
- 403: Forbidden (not friends / not owner)
- 404: Not Found

## See Also

- `MEAL_PLAN_SHARING_API.md` - Detailed API documentation
- `MEAL_PLAN_SHARING_IMPLEMENTATION.md` - Implementation details
