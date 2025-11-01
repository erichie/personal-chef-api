# Recipe Voting System Implementation

## Overview

Successfully implemented upvote/downvote functionality for recipes to track user preferences for discovery improvements.

## What Was Implemented

### 1. Database Schema Changes

- Added `VoteType` enum with `upvote` and `downvote` values
- Added `RecipeVote` model with:
  - Unique constraint on `[recipeId, userId]` to allow vote changes
  - Indexes on `recipeId`, `userId`, and `voteType` for performance
  - Relations to `User` and `Recipe` models
- Updated using `prisma db push` to sync schema

### 2. Utility Functions (`lib/recipe-utils.ts`)

Created new utility file with the following functions:

- `getRecipeVoteStats(recipeId)` - Calculate vote statistics (upvotes, downvotes, score)
- `getRecipeVoteStatsWithUserVote(recipeId, userId)` - Get stats plus user's current vote
- `upsertVote(recipeId, userId, voteType)` - Create or update a vote
- `removeVote(recipeId, userId)` - Remove user's vote

### 3. API Endpoints

#### POST `/api/recipes/[recipeId]/vote`

- Request body: `{ voteType: "upvote" | "downvote" }`
- Upserts vote (creates if new, updates if exists)
- Returns: `{ upvotes, downvotes, score, userVote }`
- Requires authentication

#### DELETE `/api/recipes/[recipeId]/vote`

- Removes user's vote
- Returns: `{ upvotes, downvotes, score }`
- Requires authentication

#### GET `/api/recipes/[recipeId]` (updated)

- Now includes vote statistics in response
- Returns: `{ recipe, votes: { upvotes, downvotes, score, userVote } }`
- `userVote` is null if user not authenticated or hasn't voted

### 4. Discovery Ranking

Updated `/api/recipes/discover/route.ts`:

- Modified SQL queries to calculate vote scores using LEFT JOIN
- Orders recipes by: `score DESC, createdAt DESC`
- Score calculation: `upvotes - downvotes`
- Includes vote counts (upvotes, downvotes, score) in each recipe object returned

## Key Features

✅ Users can upvote or downvote any recipe  
✅ Users can change their vote (upvote → downvote or vice versa)  
✅ Users can remove their vote  
✅ Anonymous users can authenticate to vote (auth required)  
✅ Vote counts visible on recipe details  
✅ Discovery feed ranks by vote score  
✅ Efficient SQL queries with proper indexes

## API Usage Examples

### Vote for a recipe

```bash
POST /api/recipes/{recipeId}/vote
Content-Type: application/json
Authorization: Bearer {token}

{
  "voteType": "upvote"
}
```

### Change vote

```bash
POST /api/recipes/{recipeId}/vote
Content-Type: application/json
Authorization: Bearer {token}

{
  "voteType": "downvote"
}
```

### Remove vote

```bash
DELETE /api/recipes/{recipeId}/vote
Authorization: Bearer {token}
```

### Get recipe with vote data

```bash
GET /api/recipes/{recipeId}
```

Response includes:

```json
{
  "recipe": { ... },
  "votes": {
    "upvotes": 10,
    "downvotes": 2,
    "score": 8,
    "userVote": "upvote"
  }
}
```

## Future Enhancements

The current implementation uses simple scoring (upvotes - downvotes). Future improvements could include:

1. **Time decay** - Favor newer highly-voted recipes
2. **Wilson score** - Better handle recipes with few votes
3. **Personalization** - Weight votes from users with similar preferences
4. **Vote velocity** - Identify trending recipes

## Technical Notes

- Vote changes are atomic using Prisma's `upsert` operation
- Database indexes ensure fast queries even with many votes
- Discovery queries use SQL aggregation for efficiency
- Compatible with both authenticated and anonymous user workflows
