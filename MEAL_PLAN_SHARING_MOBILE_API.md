# Meal Plan Sharing API - Mobile Developer Guide

## Authentication

All endpoints require authentication via session token in the request headers.

## Base URL

All endpoints are prefixed with your API base URL (e.g., `https://api.yourapp.com`)

## Important Notes

- **Flexible Day Count**: Meal plans can contain **any number of days** (minimum 1). They are NOT required to be exactly 7 days.
- **Day Structure**: Each day has a `dayNumber` (0, 1, 2, etc.) and `meals` object containing optional breakfast, lunch, and dinner.
- **Custom Sizes**: Users can create meal plans for 1 day, 3 days, 7 days, or any other duration.

---

## Meal Plan Endpoints

### 1. Create Meal Plan Template

**POST** `/api/meal-plans`

Creates a shareable meal plan template.

**Request Body:**

```json
{
  "title": "My Dinner Week",
  "description": "Simple weeknight dinners", // optional
  "days": [
    {
      "dayNumber": 0,
      "meals": {
        "breakfast": {
          // optional
          "recipeId": "uuid",
          "title": "Avocado Toast",
          "description": "Quick breakfast", // optional
          "servings": 2, // optional
          "totalMinutes": 10 // optional
        },
        "lunch": {
          // optional
          "recipeId": "uuid2",
          "title": "Caesar Salad"
        },
        "dinner": {
          // optional
          "recipeId": "uuid3",
          "title": "Chicken Stir Fry",
          "servings": 4,
          "totalMinutes": 30
        }
      }
    },
    {
      "dayNumber": 1,
      "meals": {
        "dinner": {
          // Can have just dinner, or any combination
          "recipeId": "uuid4",
          "title": "Spaghetti Bolognese"
        }
      }
    }
    // ... add as many days as you want (minimum 1)
  ]
}
```

**Response:**

```json
{
  "mealPlan": {
    "id": "uuid",
    "userId": "uuid",
    "title": "My Dinner Week",
    "description": "Simple weeknight dinners",
    "days": [
      {
        "dayNumber": 0,
        "meals": {
          "breakfast": {
            "recipeId": "uuid",
            "title": "Avocado Toast",
            "description": "Quick breakfast",
            "servings": 2,
            "totalMinutes": 10
          },
          "dinner": {
            "recipeId": "uuid3",
            "title": "Chicken Stir Fry",
            "servings": 4,
            "totalMinutes": 30
          }
        }
      }
      // ... all days
    ],
    "createdAt": "2025-10-30T12:00:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z"
  }
}
```

---

### 2. Get Meal Plan with Full Recipe Data

**GET** `/api/meal-plans/{mealPlanId}`

Retrieves a meal plan with complete recipe information (ingredients, steps, etc.).

**Response:**

```json
{
  "mealPlan": {
    "id": "uuid",
    "userId": "uuid",
    "title": "My Dinner Week",
    "description": "Simple weeknight dinners",
    "days": [
      {
        "dayNumber": 0,
        "meals": {
          "dinner": {
            "recipeId": "uuid",
            "title": "Chicken Stir Fry",
            "servings": 4,
            "totalMinutes": 30
          }
        }
      }
      // ... all days
    ],
    "recipes": [
      {
        "id": "uuid",
        "title": "Chicken Stir Fry",
        "description": "Quick and easy weeknight dinner",
        "servings": 4,
        "totalMinutes": 30,
        "tags": ["dinner", "quick", "asian"],
        "ingredients": [
          {
            "name": "chicken breast",
            "qty": 1,
            "unit": "lb",
            "canonicalId": "chicken breast"
          }
          // ... more ingredients
        ],
        "steps": [
          {
            "order": 1,
            "text": "Cut chicken into bite-sized pieces..."
          }
          // ... more steps
        ]
      }
      // ... all recipes used in the meal plan
    ],
    "createdAt": "2025-10-30T12:00:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z"
  }
}
```

---

## Meal Plan Post Endpoints

### 3. Create Meal Plan Post

**POST** `/api/meal-plan-posts`

Posts a meal plan to your feed for friends to see.

**Request Body:**

```json
{
  "mealPlanId": "uuid",
  "text": "My go-to dinners for busy weeks! 🍽️", // optional
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
    "text": "My go-to dinners for busy weeks! 🍽️",
    "photoUrl": "https://example.com/photo.jpg",
    "rating": 5,
    "createdAt": "2025-10-30T12:00:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z",
    "user": {
      "id": "uuid",
      "displayName": "Jane Doe",
      "avatarUrl": "https://example.com/avatar.jpg",
      "friendCode": "JANE123"
    }
  }
}
```

---

### 4. Get Meal Plan Post Details

**GET** `/api/meal-plan-posts/{postId}`

Gets a meal plan post with full details including the enriched meal plan, likes, and comments.

**Response:**

```json
{
  "post": {
    "id": "uuid",
    "userId": "uuid",
    "mealPlanId": "uuid",
    "text": "My go-to dinners for busy weeks! 🍽️",
    "photoUrl": "https://example.com/photo.jpg",
    "rating": 5,
    "createdAt": "2025-10-30T12:00:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z",
    "user": {
      "id": "uuid",
      "displayName": "Jane Doe",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    "mealPlan": {
      "id": "uuid",
      "title": "My Dinner Week",
      "days": [
        /* ... */
      ],
      "recipes": [
        /* full recipe data including ingredients & steps */
      ]
    },
    "likeCount": 15,
    "commentCount": 3,
    "isLikedByCurrentUser": true,
    "comments": [
      {
        "id": "uuid",
        "postId": "uuid",
        "userId": "uuid",
        "text": "This looks amazing!",
        "createdAt": "2025-10-30T12:30:00.000Z",
        "user": {
          "id": "uuid",
          "displayName": "John Smith",
          "avatarUrl": "https://example.com/avatar2.jpg"
        }
      }
    ]
  }
}
```

---

### 5. Update Meal Plan Post

**PUT** `/api/meal-plan-posts/{postId}`

Updates the text, photo, or rating of your meal plan post.

**Request Body:**

```json
{
  "text": "Updated caption", // optional
  "photoUrl": "https://example.com/new-photo.jpg", // optional
  "rating": 4 // optional, 1-5
}
```

**Response:** Same structure as Get Meal Plan Post Details

---

### 6. Delete Meal Plan Post

**DELETE** `/api/meal-plan-posts/{postId}`

Deletes your meal plan post.

**Response:**

```json
{
  "success": true
}
```

---

### 7. Like/Unlike Meal Plan Post

**POST** `/api/meal-plan-posts/{postId}/like`

Toggles like on a meal plan post. If already liked, it unlikes. If not liked, it likes.

**Response:**

```json
{
  "liked": true, // true if now liked, false if now unliked
  "likeCount": 16
}
```

---

### 8. Add Comment to Meal Plan Post

**POST** `/api/meal-plan-posts/{postId}/comment`

Adds a comment to a meal plan post.

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
    "createdAt": "2025-10-30T12:00:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z",
    "user": {
      "id": "uuid",
      "displayName": "John Smith",
      "avatarUrl": "https://example.com/avatar.jpg"
    }
  }
}
```

---

### 9. Delete Comment

**DELETE** `/api/meal-plan-posts/{postId}/comment/{commentId}`

Deletes a comment you made on a meal plan post.

**Response:**

```json
{
  "success": true
}
```

---

## Meal Plan Sharing Endpoints

### 10. Share Meal Plan to Friend

**POST** `/api/meal-plans/{mealPlanId}/share`

Sends a meal plan directly to a friend. They must be an accepted friend.

**Request Body:**

```json
{
  "recipientId": "friend-user-uuid",
  "message": "I think you'll love these dinners!" // optional
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
    "message": "I think you'll love these dinners!",
    "status": "pending", // pending, viewed, saved, or declined
    "createdAt": "2025-10-30T12:00:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z",
    "sender": {
      "id": "uuid",
      "displayName": "Jane Doe",
      "avatarUrl": "https://example.com/avatar.jpg"
    }
  }
}
```

---

### 11. Get Meal Plans Shared With You

**GET** `/api/meal-plan-shares?status={status}`

Gets meal plans that friends have shared directly with you.

**Query Parameters:**

- `status` (optional): Filter by status - `pending`, `viewed`, `saved`, or `declined`
  - Omit to get all shares regardless of status

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
      "createdAt": "2025-10-30T12:00:00.000Z",
      "updatedAt": "2025-10-30T12:00:00.000Z",
      "sender": {
        "id": "uuid",
        "displayName": "Jane Doe",
        "avatarUrl": "https://example.com/avatar.jpg"
      },
      "mealPlan": {
        "id": "uuid",
        "title": "My Dinner Week",
        "description": "...",
        "days": [
          /* ... */
        ],
        "recipes": [
          /* full recipe data with ingredients & steps */
        ]
      }
    }
  ]
}
```

---

### 12. Update Share Status

**PUT** `/api/meal-plan-shares/{shareId}`

Updates the status of a meal plan share you received.

**Request Body:**

```json
{
  "status": "saved" // must be: "viewed", "saved", or "declined"
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
    "message": "Check this out!",
    "status": "saved",
    "createdAt": "2025-10-30T12:00:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z",
    "sender": {
      "id": "uuid",
      "displayName": "Jane Doe",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    "mealPlan": {
      "id": "uuid",
      "title": "My Dinner Week",
      "description": "...",
      "days": [
        /* ... */
      ],
      "recipes": [
        /* full recipe data */
      ]
    }
  }
}
```

---

## Feed Integration

Meal plan posts automatically appear in the existing feed endpoint:

**GET** `/api/feed`

**Query Parameters:**

- `type` (optional): Filter by type
  - `all` (default): All activity types
  - `posts`: Recipe posts only
  - `meals`: Meal plan posts only
  - `saves`: Recipe saves only

**Response includes meal plan posts:**

```json
{
  "activities": [
    {
      "id": "uuid",
      "userId": "uuid",
      "activityType": "meal_plan_post",
      "mealPlanPostId": "uuid",
      "createdAt": "2025-10-30T12:00:00.000Z",
      "user": {
        "id": "uuid",
        "displayName": "Jane Doe",
        "avatarUrl": "https://example.com/avatar.jpg"
      },
      "mealPlanPost": {
        "id": "uuid",
        "text": "My go-to dinners for busy weeks! 🍽️",
        "photoUrl": "https://example.com/photo.jpg",
        "rating": 5,
        "mealPlan": {
          "id": "uuid",
          "title": "My Dinner Week",
          "days": [
            /* ... */
          ],
          "recipes": [
            /* full recipe data with ingredients & steps */
          ]
        },
        "likeCount": 15,
        "commentCount": 3,
        "isLikedByCurrentUser": false
      }
    }
    // ... other activities
  ],
  "nextCursor": "2025-10-29T12:00:00.000Z" // for pagination
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE" // optional
}
```

**HTTP Status Codes:**

- `400` - Bad Request (validation error, missing required fields)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (not allowed to access this resource)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Mobile App Integration Workflows

### Workflow 1: Posting a Meal Plan

1. User completes meals in their local meal plans
2. Extract the days they want to share
3. Remove date-specific fields:
   - Remove specific dates (`startDate`, `endDate`, `date` per day)
   - Remove tracking fields (`cooked`, `skipped`, `cookedAt`, `cookingProgress`)
4. Renumber days to start from 0 (dayNumber: 0, 1, 2, ...)
5. Call `POST /api/meal-plans` to create the template
6. Optionally call `POST /api/meal-plan-posts` to post to feed

**Example transformation:**

```javascript
// From user's local storage:
const userWeek = {
  startDate: "2025-10-27",
  endDate: "2025-11-02",
  days: [
    {
      date: "2025-10-27",
      meals: {
        dinner: {
          title: "Chicken Stir Fry",
          recipeId: "uuid1",
          cooked: false,
          // ... other fields
        },
      },
    },
    {
      date: "2025-10-28",
      meals: {
        dinner: {
          title: "Spaghetti",
          recipeId: "uuid2",
          cooked: true,
        },
      },
    },
    // ... more days
  ],
};

// Convert to template:
const template = {
  title: "My Dinner Week",
  description: "Quick weeknight dinners",
  days: userWeek.days.map((day, index) => ({
    dayNumber: index, // 0-based numbering
    meals: {
      // Only include meals that exist
      ...(day.meals.breakfast && {
        breakfast: {
          recipeId: day.meals.breakfast.recipeId,
          title: day.meals.breakfast.title,
          description: day.meals.breakfast.description,
          servings: day.meals.breakfast.servings,
          totalMinutes: day.meals.breakfast.totalMinutes,
        },
      }),
      ...(day.meals.lunch && {
        lunch: {
          recipeId: day.meals.lunch.recipeId,
          title: day.meals.lunch.title,
          // ... other fields
        },
      }),
      ...(day.meals.dinner && {
        dinner: {
          recipeId: day.meals.dinner.recipeId,
          title: day.meals.dinner.title,
          description: day.meals.dinner.description,
          servings: day.meals.dinner.servings,
          totalMinutes: day.meals.dinner.totalMinutes,
        },
      }),
    },
  })),
};
```

### Workflow 2: Saving from Feed

1. User sees meal plan post in feed (includes full recipe data)
2. User taps "Save to my week"
3. Let user select where/how to apply these days
4. Take the meal plan days and apply them:
   - Add specific dates based on user's selection
   - Add tracking fields: `cooked: false`, `skipped: false`
   - Save to local storage with chosen week ID

### Workflow 3: Direct Share

1. User shares: Call `POST /api/meal-plans/{id}/share` with `recipientId`
2. Recipient sees notification badge
3. Recipient calls `GET /api/meal-plan-shares?status=pending`
4. Recipient views the meal plan (includes full recipe data)
5. If saving: Call `PUT /api/meal-plan-shares/{id}` with `status: "saved"`
6. Apply to local storage like Workflow 2

---

## Data Validation Rules

- **Meal Plan Title**: 1-200 characters, required
- **Meal Plan Description**: Max 1000 characters, optional
- **Days Array**: Minimum 1 day, no maximum
- **Each Day**:
  - `dayNumber`: Required, must be >= 0
  - `meals`: Required object (can have breakfast, lunch, and/or dinner)
- **Each Meal** (breakfast/lunch/dinner):
  - `recipeId`: Required, must be valid UUID
  - `title`: Required string
  - `description`: Optional string
  - `servings`: Optional number
  - `totalMinutes`: Optional number
- **Post Text**: Max length (reasonable), optional
- **Post Rating**: 1-5 stars, optional
- **Comment Text**: 1-1000 characters, required
- **Share Message**: Max 500 characters, optional

---

## Notes for Mobile Developers

1. **Flexible Day Count**: Unlike requiring exactly 7 days, meal plans now support any number of days (minimum 1). This means users can share:

   - Just their 3 favorite dinners
   - A full 7-day week
   - A 5-day work week
   - Any other duration

2. **Nested Structure**: Days contain meals organized by type (breakfast/lunch/dinner). Each meal is optional - a day can have just dinner, all 3 meals, or any combination.

3. **All meal plans are enriched**: When you fetch meal plans (from feed, shares, or direct), they always include the full `recipes` array with ingredients and steps. This means you have everything needed to save locally without additional API calls.

4. **Recipe IDs**: When creating a meal plan template, make sure all `recipeId` values reference existing recipes in your Recipe table (from previously generated or saved recipes).

5. **Friend validation**: Sharing only works between accepted friends. The API will return a 403 error if trying to share with non-friends.

6. **Status tracking**: Use share status to track user engagement:

   - `pending`: Just received, not viewed yet
   - `viewed`: Opened but not saved
   - `saved`: Applied to their meal plan
   - `declined`: User rejected the share

7. **Feed pagination**: Use the `nextCursor` from feed responses for loading more activities.

8. **Idempotency**: Like/unlike is handled automatically - just call the like endpoint and it will toggle based on current state.

9. **Day Numbering**: Always use 0-based numbering (0, 1, 2, ...) for dayNumber when creating templates. The mobile app can display these however makes sense ("Day 1", "Monday", etc.).
