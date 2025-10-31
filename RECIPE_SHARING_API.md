# Recipe Sharing API - Quick Reference

## Overview

Users can share individual recipes directly with friends. Recipients get the full recipe with ingredients and steps.

You can share recipes in two ways:

1. **By ID**: Share an existing recipe you own (using the recipe's UUID)
2. **By Data**: Share any recipe by providing full recipe data (creates it if it doesn't exist in your recipes)

## Endpoints

### 1. Share Recipe to Friend (By ID)

**POST** `/api/recipes/{recipeId}/share`

Share an existing recipe that you own with a friend.

**Request Body:**

```json
{
  "recipientId": "friend-user-uuid",
  "message": "Try this recipe!" // optional
}
```

**Response:**

```json
{
  "share": {
    "id": "uuid",
    "recipeId": "uuid",
    "senderId": "uuid",
    "recipientId": "uuid",
    "message": "Try this recipe!",
    "status": "pending",
    "createdAt": "2025-10-30T12:00:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z",
    "sender": {
      "id": "uuid",
      "displayName": "Jane Doe",
      "avatarUrl": "..."
    }
  }
}
```

---

### 2. Share Recipe to Friend (By Data)

**POST** `/api/recipe-shares`

Share any recipe with a friend by providing full recipe data. If the recipe doesn't already exist in your account (matched by title), it will be created automatically.

**Request Body:**

```json
{
  "recipientId": "friend-user-uuid",
  "message": "Try this recipe!", // optional
  "recipe": {
    "title": "Chicken Stir Fry",
    "description": "Quick and delicious chicken stir fry",
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
    "source": "my-app" // optional
  }
}
```

**Alternative - Use recipeId instead:**

```json
{
  "recipientId": "friend-user-uuid",
  "message": "Try this recipe!",
  "recipeId": "existing-recipe-uuid"
}
```

**Response:**

```json
{
  "share": {
    "id": "uuid",
    "recipeId": "uuid", // newly created or existing recipe ID
    "senderId": "uuid",
    "recipientId": "uuid",
    "message": "Try this recipe!",
    "status": "pending",
    "createdAt": "2025-10-30T12:00:00.000Z",
    "updatedAt": "2025-10-30T12:00:00.000Z",
    "sender": {
      "id": "uuid",
      "displayName": "Jane Doe",
      "avatarUrl": "..."
    },
    "recipe": {
      "id": "uuid",
      "title": "Chicken Stir Fry",
      "description": "...",
      "ingredients": [...],
      "steps": [...]
    }
  }
}
```

---

### 3. Get Recipes Shared With You

**GET** `/api/recipe-shares?status={status}`

Get recipes friends have shared with you.

**Query Parameters:**

- `status` (optional): Filter by `pending`, `viewed`, `saved`, or `declined`

**Response:**

```json
{
  "shares": [
    {
      "id": "uuid",
      "recipeId": "uuid",
      "senderId": "uuid",
      "recipientId": "uuid",
      "message": "Try this recipe!",
      "status": "pending",
      "createdAt": "2025-10-30T12:00:00.000Z",
      "sender": {
        "id": "uuid",
        "displayName": "Jane Doe",
        "avatarUrl": "..."
      },
      "recipe": {
        "id": "uuid",
        "title": "Chicken Stir Fry",
        "description": "...",
        "ingredients": [
          {
            "name": "chicken breast",
            "qty": 1,
            "unit": "lb",
            "canonicalId": "chicken breast"
          }
        ],
        "steps": [
          {
            "order": 1,
            "text": "Cut chicken..."
          }
        ],
        "servings": 4,
        "totalMinutes": 30,
        "tags": ["dinner", "quick"]
      }
    }
  ]
}
```

---

### 4. Update Share Status

**PUT** `/api/recipe-shares/{shareId}`

Update the status of a recipe share you received.

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
    "status": "saved",
    "recipe": {
      // full recipe data
    }
  }
}
```

---

## Recipe Creation Logic

When sharing by data (`POST /api/recipe-shares` with `recipe` object):

1. **Duplicate Check**: Backend checks if you already have a recipe with the same title
2. **Reuse Existing**: If found, uses the existing recipe ID
3. **Create New**: If not found, creates a new recipe in your account
4. **Share**: Creates the share record pointing to the recipe

This prevents duplicate recipes while allowing you to share recipes from anywhere (e.g., meal plans, external sources).

---

## Status Flow

- **pending**: Just received, not viewed yet
- **viewed**: Opened but not saved
- **saved**: Saved to their recipes
- **declined**: User rejected the share

## Validation

- Can only share with accepted friends
- Cannot share with yourself
- When using `recipeId`, can only share recipes you own
- When using `recipe` object, recipe must have at least a title and ingredients
- Cannot share the same recipe to the same friend twice
- Message max 500 characters (optional)

## Notes

- Recipes include full data (ingredients, steps) so recipients can save immediately
- Same friendship validation as meal plan sharing
- Works bidirectionally - both users in a friendship can share with each other
- Use **by data** method when sharing recipes from meal plans or external sources
- Use **by ID** method when sharing from your personal recipe collection
