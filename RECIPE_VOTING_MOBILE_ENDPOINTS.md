# Recipe Voting Endpoints - Mobile API Spec

## Overview

Endpoints for upvoting/downvoting recipes. Users can vote, change votes, or remove votes. Vote scores are calculated as `upvotes - downvotes`.

---

## Endpoints

### 1. Vote on Recipe

**POST** `/api/recipes/{recipeId}/vote`

Cast or update your vote on a recipe.

**Authentication:** Required ✓

**Request:**

```json
{
  "voteType": "upvote" // or "downvote"
}
```

**Response (200):**

```json
{
  "upvotes": 15,
  "downvotes": 3,
  "score": 12,
  "userVote": "upvote"
}
```

**Errors:**

- `401` - Not authenticated
- `404` - Recipe not found
- `400` - Invalid voteType

**Notes:**

- If user hasn't voted: creates new vote
- If user already voted: updates to new voteType
- Use this to toggle between upvote/downvote

---

### 2. Remove Vote

**DELETE** `/api/recipes/{recipeId}/vote`

Remove your vote from a recipe.

**Authentication:** Required ✓

**Response (200):**

```json
{
  "upvotes": 14,
  "downvotes": 3,
  "score": 11
}
```

**Errors:**

- `401` - Not authenticated
- `404` - Recipe not found

**Notes:**

- No error if user hasn't voted (just returns current stats)
- Use this to implement "unvote" functionality

---

### 3. Get Recipe with Votes

**GET** `/api/recipes/{recipeId}`

Get recipe details including vote statistics.

**Authentication:** Optional (userVote will be `null` if not authenticated)

**Response (200):**

```json
{
  "recipe": {
    "id": "abc123",
    "userId": "user456",
    "title": "Spaghetti Carbonara",
    "description": "Classic Italian pasta",
    "servings": 4,
    "totalMinutes": 30,
    "tags": ["pasta", "italian", "dinner"],
    "ingredients": [
      {
        "item": "spaghetti",
        "amount": "400g"
      }
    ],
    "steps": [
      {
        "instruction": "Boil water for pasta",
        "duration": 5
      }
    ],
    "source": "generated",
    "createdAt": "2025-10-31T10:00:00.000Z",
    "updatedAt": "2025-10-31T10:00:00.000Z",
    "user": {
      "id": "user456",
      "displayName": "Chef Mario",
      "avatarUrl": "https://..."
    }
  },
  "votes": {
    "upvotes": 15,
    "downvotes": 3,
    "score": 12,
    "userVote": "upvote" // null if not authenticated or hasn't voted
  }
}
```

**Errors:**

- `404` - Recipe not found

---

### 4. Discover Recipes (with Vote Ranking)

**GET** `/api/recipes/discover?count={number}`

Get recipes ranked by vote score (highest first).

**Authentication:** Optional

**Query Parameters:**
| Parameter | Type | Required | Default | Notes |
|-----------|------|----------|---------|-------|
| count | number | No | 5 | Max: 50 |

**Response (200):**

```json
{
  "recipes": [
    {
      "id": "abc123",
      "userId": "user456",
      "title": "Spaghetti Carbonara",
      "description": "Classic Italian pasta",
      "servings": 4,
      "totalMinutes": 30,
      "tags": ["pasta", "italian"],
      "ingredients": [...],
      "steps": [...],
      "source": "generated",
      "createdAt": "2025-10-31T10:00:00.000Z",
      "updatedAt": "2025-10-31T10:00:00.000Z",
      "upvotes": 25,
      "downvotes": 3,
      "score": 22
    },
    {
      "id": "def456",
      "title": "Margherita Pizza",
      "upvotes": 18,
      "downvotes": 2,
      "score": 16,
      ...
    }
  ]
}
```

**Sort Order:**

1. By `score` (descending)
2. By `createdAt` (descending) - for recipes with same score

**Notes:**

- Recipe objects include vote counts: `upvotes`, `downvotes`, `score`
- Does NOT include `userVote` (to keep response lightweight)
- To get userVote, fetch individual recipe with GET `/api/recipes/{id}`

---

## Mobile Implementation Guide

### Swift Example

```swift
// Models
struct VoteRequest: Codable {
    let voteType: String  // "upvote" or "downvote"
}

struct VoteResponse: Codable {
    let upvotes: Int
    let downvotes: Int
    let score: Int
    let userVote: String?
}

struct RecipeWithVotes: Codable {
    let recipe: Recipe
    let votes: VoteResponse
}

// Vote on recipe
func voteRecipe(recipeId: String, voteType: String) async throws -> VoteResponse {
    let url = URL(string: "\(baseURL)/api/recipes/\(recipeId)/vote")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = VoteRequest(voteType: voteType)
    request.httpBody = try JSONEncoder().encode(body)

    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONDecoder().decode(VoteResponse.self, from: data)
}

// Remove vote
func removeVote(recipeId: String) async throws -> VoteResponse {
    let url = URL(string: "\(baseURL)/api/recipes/\(recipeId)/vote")!
    var request = URLRequest(url: url)
    request.httpMethod = "DELETE"
    request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONDecoder().decode(VoteResponse.self, from: data)
}

// Toggle upvote (upvote <-> no vote)
func toggleUpvote(recipeId: String, currentVote: String?) async throws -> VoteResponse {
    if currentVote == "upvote" {
        return try await removeVote(recipeId: recipeId)
    } else {
        return try await voteRecipe(recipeId: recipeId, voteType: "upvote")
    }
}

// Toggle downvote (downvote <-> no vote)
func toggleDownvote(recipeId: String, currentVote: String?) async throws -> VoteResponse {
    if currentVote == "downvote" {
        return try await removeVote(recipeId: recipeId)
    } else {
        return try await voteRecipe(recipeId: recipeId, voteType: "downvote")
    }
}
```

### Kotlin Example

```kotlin
// Models
data class VoteRequest(val voteType: String)

data class VoteResponse(
    val upvotes: Int,
    val downvotes: Int,
    val score: Int,
    val userVote: String?
)

data class RecipeWithVotes(
    val recipe: Recipe,
    val votes: VoteResponse
)

// Vote on recipe
suspend fun voteRecipe(recipeId: String, voteType: String): VoteResponse {
    val response = client.post("$baseUrl/api/recipes/$recipeId/vote") {
        header("Authorization", "Bearer $authToken")
        contentType(ContentType.Application.Json)
        setBody(VoteRequest(voteType))
    }
    return response.body()
}

// Remove vote
suspend fun removeVote(recipeId: String): VoteResponse {
    val response = client.delete("$baseUrl/api/recipes/$recipeId/vote") {
        header("Authorization", "Bearer $authToken")
    }
    return response.body()
}

// Toggle upvote
suspend fun toggleUpvote(recipeId: String, currentVote: String?): VoteResponse {
    return if (currentVote == "upvote") {
        removeVote(recipeId)
    } else {
        voteRecipe(recipeId, "upvote")
    }
}
```

### React Native / TypeScript Example

```typescript
interface VoteRequest {
  voteType: "upvote" | "downvote";
}

interface VoteResponse {
  upvotes: number;
  downvotes: number;
  score: number;
  userVote: "upvote" | "downvote" | null;
}

// Vote on recipe
async function voteRecipe(
  recipeId: string,
  voteType: "upvote" | "downvote"
): Promise<VoteResponse> {
  const response = await fetch(`${BASE_URL}/api/recipes/${recipeId}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ voteType }),
  });

  if (!response.ok) {
    throw new Error(`Failed to vote: ${response.status}`);
  }

  return response.json();
}

// Remove vote
async function removeVote(recipeId: string): Promise<VoteResponse> {
  const response = await fetch(`${BASE_URL}/api/recipes/${recipeId}/vote`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to remove vote: ${response.status}`);
  }

  return response.json();
}

// Toggle upvote
async function toggleUpvote(
  recipeId: string,
  currentVote: string | null
): Promise<VoteResponse> {
  if (currentVote === "upvote") {
    return removeVote(recipeId);
  } else {
    return voteRecipe(recipeId, "upvote");
  }
}
```

---

## UI/UX Recommendations

### Vote Button States

1. **Upvote Button:**

   - Inactive: Gray/outline style
   - Active (user upvoted): Green/filled style
   - Show upvote count next to button

2. **Downvote Button:**

   - Inactive: Gray/outline style
   - Active (user downvoted): Red/filled style
   - Show downvote count next to button

3. **Score Display:**
   - Show net score prominently: `+12`, `-3`, `0`
   - Use color: positive (green), negative (red), zero (gray)

### Interaction Pattern

```
User taps upvote:
  - If not voted → upvote (animate to filled green)
  - If already upvoted → remove vote (animate to outline gray)
  - If downvoted → change to upvote (animate from red to green)

User taps downvote:
  - If not voted → downvote (animate to filled red)
  - If already downvoted → remove vote (animate to outline gray)
  - If upvoted → change to downvote (animate from green to red)
```

### Optimistic Updates

For better UX, update UI immediately and revert on error:

```typescript
// Optimistic UI update example
function handleUpvote(recipe: RecipeWithVotes) {
  const optimisticVotes = {
    ...recipe.votes,
    upvotes: recipe.votes.userVote === "upvote"
      ? recipe.votes.upvotes - 1
      : recipe.votes.upvotes + 1,
    downvotes: recipe.votes.userVote === "downvote"
      ? recipe.votes.downvotes - 1
      : recipe.votes.downvotes,
    score: /* calculate new score */,
    userVote: recipe.votes.userVote === "upvote" ? null : "upvote",
  };

  // Update UI immediately
  updateRecipeInUI(recipe.id, optimisticVotes);

  // Make API call
  try {
    const result = await toggleUpvote(recipe.id, recipe.votes.userVote);
    // Update with server response
    updateRecipeInUI(recipe.id, result);
  } catch (error) {
    // Revert on error
    updateRecipeInUI(recipe.id, recipe.votes);
    showError("Failed to vote");
  }
}
```

---

## Testing

### Base URL

- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

### Test Account

Contact backend team for test credentials.

### Quick Test Sequence

1. GET `/api/recipes/discover?count=5` - Get some recipes
2. POST `/api/recipes/{id}/vote` with `{"voteType": "upvote"}`
3. GET `/api/recipes/{id}` - Verify vote is recorded
4. POST `/api/recipes/{id}/vote` with `{"voteType": "downvote"}` - Change vote
5. DELETE `/api/recipes/{id}/vote` - Remove vote
6. GET `/api/recipes/{id}` - Verify vote is removed

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Recipe IDs and User IDs are UUIDs
- Vote changes are instant (no undo delay needed on backend)
- Anonymous users must authenticate before voting
- Discovery feed caches may have ~60s delay for vote updates

---

## Support

For questions or issues, contact the backend team or check:

- Full API docs: `RECIPE_VOTING_API.md`
- Implementation details: `RECIPE_VOTING_IMPLEMENTATION.md`
