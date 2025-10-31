# Meal Plan Sharing API Documentation

This document describes the API endpoints for meal plan sharing features, allowing users to post meal plans to their feed and share them directly with friends.

## Overview

The meal plan sharing system consists of three main components:

1. **Meal Plans**: Template meal plans (7 days) that can be shared
2. **Meal Plan Posts**: Public posts of meal plans that appear in friends' feeds
3. **Meal Plan Shares**: Direct shares to specific friends

## Data Structure

### Template Meal Plan

Meal plans are stored as templates (not tied to specific dates). When a user saves a meal plan from the feed or a share, the mobile app applies it to their chosen week in `UserProfile.mealPlans`.

```typescript
{
  "id": "uuid",
  "userId": "uuid",
  "title": "My Awesome Week of Meals",
  "description": "A balanced week with variety",
  "days": [
    {
      "dayNumber": 0,  // 0-6 for relative days
      "meals": {
        "breakfast": {
          "recipeId": "uuid",
          "title": "Avocado Toast",
          "description": "...",
          "servings": 2,
          "totalMinutes": 10
        },
        "lunch": { /* ... */ },
        "dinner": { /* ... */ }
      }
    },
    // ... 6 more days
  ],
  "createdAt": "2025-10-30T...",
  "updatedAt": "2025-10-30T..."
}
```

### Enriched Meal Plan

When fetching meal plans for display in the feed or shares, they are enriched with full recipe data:

```typescript
{
  ...mealPlan,
  "recipes": [
    {
      "id": "uuid",
      "title": "Avocado Toast",
      "description": "...",
      "ingredients": [...],
      "steps": [...],
      "tags": [...],
      // ... full recipe data
    }
    // ... all recipes used in the meal plan
  ]
}
```

## API Endpoints

### 1. Create Meal Plan

Create a shareable meal plan template from existing recipes.

**Endpoint:** `POST /api/meal-plans`

**Request Body:**

```json
{
  "title": "My Awesome Week",
  "description": "Optional description",
  "days": [
    {
      "dayNumber": 0,
      "meals": {
        "breakfast": {
          "recipeId": "recipe-uuid",
          "title": "Avocado Toast",
          "description": "Simple and delicious",
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
    // ... must have exactly 7 days (0-6)
  ]
}
```

**Response:**

```json
{
  "mealPlan": {
    "id": "uuid",
    "userId": "uuid",
    "title": "My Awesome Week",
    "description": "Optional description",
    "days": [...],
    "createdAt": "2025-10-30T...",
    "updatedAt": "2025-10-30T..."
  }
}
```

---

### 2. Get Meal Plan by ID

Retrieve a meal plan with full recipe data (ingredients, steps, etc.).

**Endpoint:** `GET /api/meal-plans/{mealPlanId}`

**Response:**

```json
{
  "mealPlan": {
    "id": "uuid",
    "userId": "uuid",
    "title": "My Awesome Week",
    "days": [...],
    "recipes": [
      {
        "id": "recipe-uuid",
        "title": "Avocado Toast",
        "ingredients": [...],
        "steps": [...],
        // ... full recipe data
      }
    ]
  }
}
```

---

### 3. Create Meal Plan Post

Post a meal plan to your feed for friends to see.

**Endpoint:** `POST /api/meal-plan-posts`

**Request Body:**

```json
{
  "mealPlanId": "uuid",
  "text": "Just finished this amazing week of meals! 🍽️",
  "photoUrl": "https://example.com/photo.jpg", // optional
  "rating": 5 // optional, 1-5
}
```

**Response:**

```json
{
  "post": {
    "id": "uuid",
    "userId": "uuid",
    "mealPlanId": "uuid",
    "text": "Just finished this amazing week of meals! 🍽️",
    "photoUrl": "https://example.com/photo.jpg",
    "rating": 5,
    "createdAt": "2025-10-30T...",
    "updatedAt": "2025-10-30T..."
  }
}
```

---

### 4. Get Meal Plan Post

Get a meal plan post with full details including the enriched meal plan, likes, and comments.

**Endpoint:** `GET /api/meal-plan-posts/{postId}`

**Response:**

```json
{
  "post": {
    "id": "uuid",
    "userId": "uuid",
    "mealPlanId": "uuid",
    "text": "...",
    "mealPlan": {
      // enriched meal plan with full recipe data
      "recipes": [...]
    },
    "likeCount": 15,
    "commentCount": 3,
    "isLikedByCurrentUser": true,
    "comments": [...]
  }
}
```

---

### 5. Update Meal Plan Post

Update the text, photo, or rating of your meal plan post.

**Endpoint:** `PUT /api/meal-plan-posts/{postId}`

**Request Body:**

```json
{
  "text": "Updated caption",
  "photoUrl": "https://example.com/new-photo.jpg",
  "rating": 4
}
```

**Response:** Same as Get Meal Plan Post

---

### 6. Delete Meal Plan Post

Delete your meal plan post.

**Endpoint:** `DELETE /api/meal-plan-posts/{postId}`

**Response:**

```json
{
  "success": true
}
```

---

### 7. Like/Unlike Meal Plan Post

Toggle like on a meal plan post.

**Endpoint:** `POST /api/meal-plan-posts/{postId}/like`

**Response:**

```json
{
  "liked": true,
  "likeCount": 16
}
```

---

### 8. Add Comment to Meal Plan Post

Add a comment to a meal plan post.

**Endpoint:** `POST /api/meal-plan-posts/{postId}/comment`

**Request Body:**

```json
{
  "text": "This looks amazing! Can't wait to try it!"
}
```

**Response:**

```json
{
  "comment": {
    "id": "uuid",
    "postId": "uuid",
    "userId": "uuid",
    "text": "This looks amazing! Can't wait to try it!",
    "createdAt": "2025-10-30T...",
    "user": {
      "id": "uuid",
      "displayName": "John Doe",
      "avatarUrl": "..."
    }
  }
}
```

---

### 9. Delete Comment

Delete a comment you made on a meal plan post.

**Endpoint:** `DELETE /api/meal-plan-posts/{postId}/comment/{commentId}`

**Response:**

```json
{
  "success": true
}
```

---

### 10. Share Meal Plan to Friend

Send a meal plan directly to a friend (they'll receive a notification).

**Endpoint:** `POST /api/meal-plans/{mealPlanId}/share`

**Request Body:**

```json
{
  "recipientId": "friend-user-id",
  "message": "I think you'll love this week of meals!" // optional
}
```

**Response:**

```json
{
  "share": {
    "id": "uuid",
    "mealPlanId": "uuid",
    "senderId": "uuid",
    "recipientId": "uuid",
    "message": "I think you'll love this week of meals!",
    "status": "pending",
    "createdAt": "2025-10-30T...",
    "sender": {
      "id": "uuid",
      "displayName": "Jane Doe",
      "avatarUrl": "..."
    }
  }
}
```

---

### 11. Get Meal Plans Shared With You

Get meal plans that friends have shared directly with you.

**Endpoint:** `GET /api/meal-plan-shares?status={status}`

**Query Parameters:**

- `status` (optional): Filter by status - `pending`, `viewed`, `saved`, or `declined`

**Response:**

```json
{
  "shares": [
    {
      "id": "uuid",
      "mealPlanId": "uuid",
      "senderId": "uuid",
      "recipientId": "uuid",
      "message": "Check this out!",
      "status": "pending",
      "createdAt": "2025-10-30T...",
      "sender": {
        "id": "uuid",
        "displayName": "Jane Doe",
        "avatarUrl": "..."
      },
      "mealPlan": {
        // enriched meal plan with full recipe data
        "recipes": [...]
      }
    }
  ]
}
```

---

### 12. Update Share Status

Update the status of a meal plan share (mark as viewed, saved, or declined).

**Endpoint:** `PUT /api/meal-plan-shares/{shareId}`

**Request Body:**

```json
{
  "status": "saved" // or "viewed" or "declined"
}
```

**Response:**

```json
{
  "share": {
    "id": "uuid",
    "status": "saved",
    "mealPlan": {
      // enriched meal plan with full recipe data
    }
  }
}
```

---

## Feed Integration

Meal plan posts automatically appear in the friends' feed alongside recipe posts. The feed endpoint (`GET /api/feed`) already supports meal plan posts:

**Feed Activity Type:** `meal_plan_post`

**Feed Response:**

```json
{
  "activities": [
    {
      "id": "uuid",
      "userId": "uuid",
      "activityType": "meal_plan_post",
      "mealPlanPostId": "uuid",
      "createdAt": "2025-10-30T...",
      "user": {...},
      "mealPlanPost": {
        "id": "uuid",
        "mealPlan": {
          // enriched with full recipe data
          "recipes": [...]
        },
        "likeCount": 15,
        "commentCount": 3,
        "isLikedByCurrentUser": false
      }
    }
  ]
}
```

## Mobile App Integration

### Workflow: Posting a Meal Plan

1. User completes a week in their `UserProfile.mealPlans`
2. Mobile app extracts the meal plan data (7 days with meals)
3. Strips out date-specific fields (startDate, endDate, date per day, cooked/skipped tracking)
4. Creates template structure with `dayNumber` (0-6) and meal references
5. Calls `POST /api/meal-plans` to create the shareable template
6. Optionally calls `POST /api/meal-plan-posts` to post to feed

### Workflow: Saving a Meal Plan from Feed

1. User sees meal plan post in feed (includes full recipe data)
2. User taps "Save to my week"
3. Mobile app receives enriched meal plan with all recipes
4. User selects which week to apply it to
5. Mobile app applies the template to the chosen week:
   - Adds specific dates
   - Initializes tracking fields (cooked: false, skipped: false)
   - Saves to `UserProfile.mealPlans`

### Workflow: Direct Share to Friend

1. User shares meal plan: `POST /api/meal-plans/{id}/share`
2. Recipient sees notification
3. Recipient calls `GET /api/meal-plan-shares` to view
4. Recipient can update status: `PUT /api/meal-plan-shares/{id}` with status "saved"
5. Mobile app saves to recipient's `UserProfile.mealPlans`

## Error Handling

All endpoints use standard error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:

- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (not allowed to access resource)
- `404` - Not Found
- `500` - Internal Server Error

## Notes

- Meal plans must have exactly 7 days (dayNumber 0-6)
- Each day can have breakfast, lunch, and/or dinner (all optional)
- Recipe IDs must reference existing recipes in the Recipe table
- Direct shares only work between friends
- Feed shows meal plan posts from friends only
- All meal plan posts and shares include full recipe data (ingredients, steps) for easy saving by recipients
