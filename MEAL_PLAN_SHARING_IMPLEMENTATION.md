# Meal Plan Sharing Implementation Summary

## Overview

Successfully implemented meal plan sharing functionality that allows users to:

1. Post their entire meal plans to the feed for friends to see
2. Share meal plans directly to specific friends
3. Like, comment, and interact with meal plan posts
4. Save meal plans from friends to their own weeks (handled by mobile app)

## What Was Implemented

### 1. Database Schema Changes

Added five new tables to support meal plan sharing:

- **`MealPlan`**: Stores meal plan templates (7 days, not tied to specific dates)

  - Contains: id, userId, title, description, days (JSON), timestamps
  - Days are stored as relative (dayNumber 0-6) for reusability

- **`MealPlanPost`**: Posts that reference meal plans

  - Contains: id, userId, mealPlanId, text, photoUrl, rating, timestamps
  - Similar to RecipePost but for meal plans

- **`MealPlanPostLike`**: Likes on meal plan posts

  - Contains: id, postId, userId, timestamp
  - Unique constraint on (postId, userId)

- **`MealPlanPostComment`**: Comments on meal plan posts

  - Contains: id, postId, userId, text, timestamps

- **`MealPlanShare`**: Direct shares to friends
  - Contains: id, mealPlanId, senderId, recipientId, message, status, timestamps
  - Status can be: pending, viewed, saved, declined

Also added:

- **`ShareStatus` enum**: pending, viewed, saved, declined
- Updated **`FeedActivity`** table to include `mealPlanPostId` field
- Updated `activityType` to support "meal_plan_post"

### 2. Type Definitions

Added comprehensive TypeScript interfaces in `lib/types.ts`:

- `TemplateMeal`: Meal without dates or tracking
- `TemplateDayMeals`: Breakfast, lunch, dinner structure
- `TemplateMealPlanDay`: Day with dayNumber and meals
- `MealPlan`: Base meal plan type
- `MealPlanWithRecipes`: Enriched with full recipe data
- `MealPlanPost`: Post with meal plan
- `MealPlanPostComment`: Comment type
- `MealPlanShare`: Share type
- Updated `FeedActivity` to support meal plan posts

### 3. Utility Functions

Created `lib/meal-plan-utils.ts` with comprehensive functions:

- `createMealPlan()`: Store a meal plan template
- `getMealPlan()`: Retrieve by ID
- `enrichMealPlanWithRecipes()`: Fetch full recipe data for all recipes in plan
- `createMealPlanPost()`: Create a post (also creates feed activity)
- `updateMealPlanPost()`: Update post details
- `deleteMealPlanPost()`: Delete post and feed activity
- `toggleMealPlanPostLike()`: Like/unlike functionality
- `addMealPlanPostComment()`: Add comment
- `deleteMealPlanPostComment()`: Delete comment
- `getMealPlanPostWithDetails()`: Get post with enriched meal plan
- `shareMealPlanToFriend()`: Create direct share
- `getSharedMealPlans()`: Get shares received by user
- `updateMealPlanShareStatus()`: Update share status

Updated `lib/feed-utils.ts`:

- Modified `createFeedActivity()` to support meal plan posts
- Updated `getFriendsFeed()` to enrich and include meal plan posts
- Updated `getUserActivity()` to enrich and include meal plan posts
- Both functions now fetch full recipe data for meal plans

### 4. API Endpoints

Created 12 new API endpoints:

**Meal Plan Management:**

- `POST /api/meal-plans` - Create meal plan template
- `GET /api/meal-plans/[mealPlanId]` - Get with full recipe data

**Meal Plan Posts:**

- `POST /api/meal-plan-posts` - Create post
- `GET /api/meal-plan-posts/[postId]` - Get with details
- `PUT /api/meal-plan-posts/[postId]` - Update post
- `DELETE /api/meal-plan-posts/[postId]` - Delete post
- `POST /api/meal-plan-posts/[postId]/like` - Toggle like
- `POST /api/meal-plan-posts/[postId]/comment` - Add comment
- `DELETE /api/meal-plan-posts/[postId]/comment/[commentId]` - Delete comment

**Direct Sharing:**

- `POST /api/meal-plans/[mealPlanId]/share` - Share to friend
- `GET /api/meal-plan-shares` - Get shares received
- `PUT /api/meal-plan-shares/[shareId]` - Update share status

### 5. Feed Integration

Meal plan posts automatically appear in the friends' feed:

- Activity type: `"meal_plan_post"`
- Includes full recipe data (ingredients, steps) for all recipes in the plan
- Supports filtering by type: `?type=meals` to see only meal plan posts
- Same interaction features as recipe posts (like, comment)

## Data Flow

### Creating and Posting a Meal Plan

```
UserProfile.mealPlans (specific week with dates)
    ↓ Mobile app extracts template
    ↓ Strips dates, tracking fields
MealPlan table (template with dayNumbers)
    ↓ Create post
MealPlanPost table
    ↓ Create feed activity
FeedActivity table
    ↓ Friends view feed
Enriched with full recipe data
    ↓ Friend saves
Friend's UserProfile.mealPlans (applied to chosen week)
```

### Direct Sharing

```
User's MealPlan
    ↓ Share to friend
MealPlanShare table (status: pending)
    ↓ Friend views
Enriched with full recipe data
    ↓ Friend updates status to "saved"
Friend's UserProfile.mealPlans (mobile app handles saving)
```

## Key Design Decisions

1. **Template Structure**: Meal plans are stored without specific dates (dayNumber 0-6) making them reusable templates

2. **Full Recipe Enrichment**: When fetching meal plans for feed or shares, we always include full recipe data (ingredients, steps) so mobile apps have everything needed to save

3. **Separate Tables**: Used dedicated tables (MealPlan, MealPlanPost) following the same pattern as Recipe/RecipePost for consistency

4. **Mobile App Responsibility**: The mobile app handles:

   - Converting UserProfile.mealPlans to templates when posting
   - Applying templates to specific weeks when saving
   - Managing date-specific fields and tracking (cooked, skipped)

5. **Friend-Only Sharing**: Both feed posts and direct shares only work between friends (verified in utility functions)

## Database Updates

Successfully ran `prisma db push` to update the database schema with all new tables, indexes, and foreign keys. The Prisma Client was regenerated with the new types.

## Testing Recommendations

To test the implementation:

1. **Create a Meal Plan**:

   ```bash
   POST /api/meal-plans
   # with 7 days of meals referencing existing recipe IDs
   ```

2. **Post to Feed**:

   ```bash
   POST /api/meal-plan-posts
   # with the mealPlanId from step 1
   ```

3. **View in Feed**:

   ```bash
   GET /api/feed
   # should see meal plan posts with full recipe data
   ```

4. **Share Directly**:

   ```bash
   POST /api/meal-plans/{id}/share
   # with recipientId of a friend
   ```

5. **Check Shares**:
   ```bash
   GET /api/meal-plan-shares
   # as the recipient user
   ```

## Mobile App Integration Notes

The mobile app needs to:

1. **When posting a meal plan**:

   - Extract the meal plan from `UserProfile.mealPlans`
   - Remove: startDate, endDate, date per day, cooked, skipped, cookedAt, cookingProgress
   - Convert to template format with dayNumber 0-6
   - Call `POST /api/meal-plans` then optionally `POST /api/meal-plan-posts`

2. **When saving from feed/share**:
   - Receive enriched meal plan with all recipe data
   - Let user choose which week to apply it to
   - Add specific dates based on chosen week
   - Initialize tracking fields (cooked: false, skipped: false)
   - Save to `UserProfile.mealPlans[weekId]`
   - If from a share, call `PUT /api/meal-plan-shares/{id}` with status "saved"

## Files Created/Modified

### Created:

- `lib/meal-plan-utils.ts` - All meal plan utility functions
- `app/api/meal-plans/route.ts` - Create meal plan
- `app/api/meal-plans/[mealPlanId]/route.ts` - Get meal plan
- `app/api/meal-plans/[mealPlanId]/share/route.ts` - Share to friend
- `app/api/meal-plan-posts/route.ts` - Create post
- `app/api/meal-plan-posts/[postId]/route.ts` - Get/update/delete post
- `app/api/meal-plan-posts/[postId]/like/route.ts` - Like/unlike
- `app/api/meal-plan-posts/[postId]/comment/route.ts` - Add comment
- `app/api/meal-plan-posts/[postId]/comment/[commentId]/route.ts` - Delete comment
- `app/api/meal-plan-shares/route.ts` - Get shares
- `app/api/meal-plan-shares/[shareId]/route.ts` - Update share status
- `MEAL_PLAN_SHARING_API.md` - Complete API documentation
- `MEAL_PLAN_SHARING_IMPLEMENTATION.md` - This file

### Modified:

- `prisma/schema.prisma` - Added 5 new tables, 1 enum, updated User and FeedActivity
- `lib/types.ts` - Added meal plan sharing type definitions
- `lib/feed-utils.ts` - Updated to support meal plan posts

## Next Steps

1. Test all endpoints with real data
2. Add any additional validation or error handling as needed
3. Consider adding analytics/tracking for meal plan shares
4. Consider adding search/discovery for popular meal plans
5. Consider adding categories/tags for meal plans

## Success Metrics

All planned features have been implemented:

- ✅ Meal plan storage as templates
- ✅ Meal plan posts to feed
- ✅ Direct sharing to friends
- ✅ Like and comment functionality
- ✅ Full recipe data enrichment
- ✅ Status tracking for shares
- ✅ Feed integration
- ✅ Complete API documentation
- ✅ Database schema updated
- ✅ Zero linting errors

The implementation is complete and ready for testing!
