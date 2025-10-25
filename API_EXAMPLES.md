# API Examples

This document provides cURL examples and usage documentation for all API endpoints.

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [Guest & Device Linking](#guest--device-linking)
3. [Sync Endpoints](#sync-endpoints)
4. [AI Endpoints](#ai-endpoints)

---

## Authentication Endpoints

### Sign Up

Create a new user account.

```bash
curl -X POST http://localhost:3000/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "name": "John Doe"
  }'
```

**Response:**

```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "session": {
    "token": "session-token",
    "expiresAt": "2025-11-25T00:00:00Z"
  }
}
```

### Sign In

Sign in to an existing account.

```bash
curl -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

**Response:**

```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com"
  },
  "session": {
    "token": "session-token",
    "expiresAt": "2025-11-25T00:00:00Z"
  }
}
```

### Sign Out

Sign out from current session.

```bash
curl -X POST http://localhost:3000/api/auth/sign-out \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

**Response:**

```json
{
  "success": true
}
```

### Get Session

Get current session information.

```bash
curl -X GET http://localhost:3000/api/auth/session \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

**Response:**

```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com"
  },
  "session": {
    "expiresAt": "2025-11-25T00:00:00Z"
  }
}
```

---

## Guest & Device Linking

### Create Guest User

Create a guest user account with device ID (idempotent).

```bash
curl -X POST http://localhost:3000/api/auth/guest \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device-12345"
  }'
```

**Response:**

```json
{
  "user": {
    "id": "guest-user-uuid",
    "deviceId": "device-12345",
    "isGuest": true,
    "createdAt": "2025-10-25T00:00:00Z"
  },
  "session": {
    "token": "guest-session-token",
    "expiresAt": "2025-11-25T00:00:00Z"
  }
}
```

### Link Device to Account

Link a guest device to an authenticated user account (migrates all guest data).

```bash
curl -X POST http://localhost:3000/api/auth/link-device \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "deviceId": "device-12345"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Device linked successfully",
  "userId": "user-uuid"
}
```

---

## Sync Endpoints

### Upload Device State (POST /api/sync)

Upload and merge device state with backend.

**Using Session Token:**

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "chefIntake": {
      "id": "intake-1",
      "desiredCookingFrequency": 5,
      "cookingSkillLevel": "INTERMEDIATE",
      "maxCookingTime": 45,
      "goals": [],
      "dietStyles": [],
      "allergies": [],
      "restrictions": [],
      "favorites": [],
      "dislikes": [],
      "cuisines": [],
      "flavors": [],
      "completedBasicOnboarding": true,
      "completedAdvancedOnboarding": false,
      "createdAt": "2025-10-25T00:00:00Z",
      "updatedAt": "2025-10-25T00:00:00Z"
    },
    "inventory": [
      {
        "id": "inv-1",
        "name": "Olive Oil",
        "location": "pantry",
        "quantity": 1,
        "unit": "bottle",
        "addedAt": "2025-10-25T00:00:00Z"
      }
    ],
    "mealPlans": {},
    "groceryList": [],
    "achievements": {},
    "streaks": {
      "mealPlanStreak": {
        "currentStreak": 0,
        "bestStreak": 0,
        "lastActivityDate": null,
        "totalCount": 0,
        "lastBrokenStreak": 0,
        "brokenAt": null
      },
      "cookingStreak": {
        "currentStreak": 0,
        "bestStreak": 0,
        "lastActivityDate": null,
        "totalCount": 0,
        "lastBrokenStreak": 0,
        "brokenAt": null
      }
    },
    "tokenState": {
      "balance": 100,
      "lifetimeEarned": 100,
      "lifetimeSpent": 0,
      "transactions": []
    }
  }'
```

**Using Device ID (Guest):**

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -H "X-Device-ID: device-12345" \
  -d '{
    "chefIntake": { ... },
    "inventory": [ ... ]
  }'
```

**Response:**

```json
{
  "syncedAt": "2025-10-25T12:00:00Z",
  "version": 1
}
```

### Download User Backup (GET /api/sync)

Download full user backup including profile and recipes.

```bash
curl -X GET http://localhost:3000/api/sync \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

**Response:**

```json
{
  "profile": {
    "chefIntake": { ... },
    "inventory": [ ... ],
    "mealPlans": { ... },
    "groceryList": [ ... ],
    "achievements": { ... },
    "streaks": { ... },
    "tokenState": { ... },
    "lastSyncedAt": "2025-10-25T12:00:00Z",
    "syncVersion": 5
  },
  "recipes": [
    {
      "id": "recipe-uuid",
      "title": "Spaghetti Carbonara",
      "description": "Classic Italian pasta dish",
      "servings": 4,
      "totalMinutes": 30,
      "tags": ["pasta", "italian", "quick"],
      "ingredients": [
        {
          "name": "Spaghetti",
          "qty": 400,
          "unit": "g"
        }
      ],
      "steps": [
        {
          "order": 1,
          "text": "Boil water for pasta"
        }
      ],
      "source": "meal-plan",
      "createdAt": "2025-10-20T00:00:00Z",
      "updatedAt": "2025-10-20T00:00:00Z"
    }
  ]
}
```

---

## AI Endpoints

### Generate Meal Plan (POST /api/ai/meal-plan)

Generate a personalized meal plan using AI.

```bash
curl -X POST http://localhost:3000/api/ai/meal-plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "preferences": {
      "startDate": "2025-10-27",
      "endDate": "2025-11-02",
      "mealsPerDay": ["dinner"],
      "chefIntake": {
        "cookingSkillLevel": "INTERMEDIATE",
        "maxCookingTime": 45,
        "dietStyles": [{"id": "1", "name": "Mediterranean"}],
        "allergies": [],
        "cuisines": [
          {"id": "1", "cuisine": "Italian", "level": "LOVE"}
        ]
      },
      "includeInventory": true
    },
    "inventory": [
      {
        "id": "inv-1",
        "name": "Olive Oil",
        "location": "pantry",
        "quantity": 1,
        "unit": "bottle"
      }
    ]
  }'
```

**Response:**

```json
{
  "mealPlan": {
    "startDate": "2025-10-27",
    "endDate": "2025-11-02",
    "days": [
      {
        "date": "2025-10-27",
        "meals": {
          "dinner": {
            "id": "recipe-uuid",
            "title": "Lemon Garlic Chicken",
            "servings": 4,
            "totalMinutes": 40,
            "ingredients": [ ... ],
            "steps": [ ... ]
          }
        }
      }
    ],
    "grocery": {
      "missingItems": [
        {
          "name": "Chicken Breast",
          "qty": 4,
          "unit": "pieces",
          "recipes": ["Lemon Garlic Chicken"]
        }
      ]
    }
  },
  "recipesCreated": 7,
  "message": "Meal plan generated successfully"
}
```

### Replace Recipe (POST /api/ai/replace-recipe)

Generate an alternative recipe using AI.

```bash
curl -X POST http://localhost:3000/api/ai/replace-recipe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "originalRecipe": {
      "title": "Beef Stew",
      "totalMinutes": 180,
      "ingredients": [
        {"name": "Beef Chuck", "qty": 2, "unit": "lbs"}
      ]
    },
    "replacementReason": "Need something quicker, under 45 minutes",
    "preferences": {
      "cookingSkillLevel": "INTERMEDIATE",
      "maxCookingTime": 45
    }
  }'
```

**Response:**

```json
{
  "recipe": {
    "id": "recipe-uuid",
    "title": "Quick Beef Stir Fry",
    "description": "Fast and flavorful beef stir fry with vegetables",
    "servings": 4,
    "totalMinutes": 25,
    "tags": ["quick", "stir-fry", "beef"],
    "ingredients": [
      {
        "name": "Beef Sirloin",
        "qty": 1,
        "unit": "lb",
        "notes": "thinly sliced"
      },
      {
        "name": "Bell Peppers",
        "qty": 2,
        "unit": "whole"
      }
    ],
    "steps": [
      {
        "order": 1,
        "text": "Heat wok over high heat with oil"
      },
      {
        "order": 2,
        "text": "Stir fry beef until browned, about 3 minutes"
      }
    ],
    "source": "generated",
    "createdAt": "2025-10-25T12:00:00Z"
  },
  "message": "Replacement recipe generated successfully"
}
```

### Parse Recipe from URL (POST /api/ai/parse-recipe)

Extract and parse a recipe from any cooking website URL using AI.

```bash
curl -X POST http://localhost:3000/api/ai/parse-recipe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "url": "https://www.example.com/recipe/chocolate-chip-cookies"
  }'
```

**Response:**

```json
{
  "recipe": {
    "id": "recipe-uuid",
    "title": "Best Chocolate Chip Cookies",
    "description": "Soft and chewy chocolate chip cookies with a crispy edge",
    "servings": 24,
    "totalMinutes": 30,
    "tags": ["dessert", "cookies", "baking"],
    "ingredients": [
      {
        "name": "All-purpose flour",
        "qty": 2.25,
        "unit": "cups"
      },
      {
        "name": "Butter",
        "qty": 1,
        "unit": "cup",
        "notes": "softened"
      },
      {
        "name": "Chocolate chips",
        "qty": 2,
        "unit": "cups"
      }
    ],
    "steps": [
      {
        "order": 1,
        "text": "Preheat oven to 375°F (190°C)"
      },
      {
        "order": 2,
        "text": "Mix butter and sugars until creamy"
      }
    ],
    "source": "pasted",
    "sourceUrl": "https://www.example.com/recipe/chocolate-chip-cookies",
    "createdAt": "2025-10-25T12:00:00Z"
  },
  "message": "Recipe parsed successfully"
}
```

**Notes:**

- Supports most popular recipe websites
- AI extracts ingredients, steps, timing, and servings
- URL must be publicly accessible
- Recipe is automatically saved to your collection

---

## Authentication Methods

All protected endpoints support three authentication methods:

1. **Session Token (Registered Users)**

   ```bash
   -H "Authorization: Bearer YOUR_SESSION_TOKEN"
   ```

2. **Cookie (Browser)**

   ```bash
   # Automatically included by browser
   Cookie: better-auth.session_token=YOUR_SESSION_TOKEN
   ```

3. **Device ID (Guest Users)**
   ```bash
   -H "X-Device-ID: your-device-id"
   ```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

Common error codes:

- `UNAUTHORIZED` (401) - Authentication required or invalid
- `FORBIDDEN` (403) - Action not allowed
- `NOT_FOUND` (404) - Resource not found
- `BAD_REQUEST` (400) - Invalid request data
- `VALIDATION_ERROR` (400) - Request validation failed
- `CONFLICT` (409) - Resource conflict (duplicate)
- `INTERNAL_ERROR` (500) - Server error
- `SERVICE_UNAVAILABLE` (503) - External service unavailable

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Replace `http://localhost:3000` with your actual API URL
- Replace `YOUR_SESSION_TOKEN` with actual session token from auth endpoints
- Replace `device-12345` with your actual device identifier
- AI endpoints require valid OpenAI API key in environment variables
- Guest users can use most endpoints by providing `X-Device-ID` header
