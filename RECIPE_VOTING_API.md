# Recipe Voting API Reference

## Endpoints

### Vote on a Recipe

**POST** `/api/recipes/:recipeId/vote`

Cast or change your vote on a recipe.

**Authentication:** Required

**Request Body:**

```json
{
  "voteType": "upvote" | "downvote"
}
```

**Response:**

```json
{
  "upvotes": 10,
  "downvotes": 2,
  "score": 8,
  "userVote": "upvote"
}
```

**Example:**

```bash
curl -X POST https://api.example.com/api/recipes/abc123/vote \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"voteType": "upvote"}'
```

---

### Remove Your Vote

**DELETE** `/api/recipes/:recipeId/vote`

Remove your vote from a recipe.

**Authentication:** Required

**Response:**

```json
{
  "upvotes": 9,
  "downvotes": 2,
  "score": 7
}
```

**Example:**

```bash
curl -X DELETE https://api.example.com/api/recipes/abc123/vote \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Get Recipe with Vote Data

**GET** `/api/recipes/:recipeId`

Get recipe details including vote statistics.

**Authentication:** Optional (userVote will be null if not authenticated)

**Response:**

```json
{
  "recipe": {
    "id": "abc123",
    "title": "Spaghetti Carbonara",
    "description": "Classic Italian pasta dish",
    "ingredients": [...],
    "steps": [...],
    ...
  },
  "votes": {
    "upvotes": 10,
    "downvotes": 2,
    "score": 8,
    "userVote": "upvote"  // null if not authenticated or hasn't voted
  }
}
```

**Example:**

```bash
curl https://api.example.com/api/recipes/abc123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Discover Recipes (with vote ranking)

**GET** `/api/recipes/discover?count=10`

Get recipes ranked by vote score (upvotes - downvotes).

**Authentication:** Optional

**Query Parameters:**

- `count` (optional): Number of recipes to return (default: 5, max: 50)

**Response:**

```json
{
  "recipes": [
    {
      "id": "abc123",
      "title": "Spaghetti Carbonara",
      "description": "Classic Italian pasta dish",
      "ingredients": [...],
      "steps": [...],
      "upvotes": 25,
      "downvotes": 3,
      "score": 22,
      ...
    },
    ...
  ]
}
```

**Example:**

```bash
curl "https://api.example.com/api/recipes/discover?count=10"
```

---

## Vote Behavior

- **First Vote**: Creates a new vote record
- **Change Vote**: Updates the existing vote (e.g., upvote → downvote)
- **Remove Vote**: Deletes the vote record
- **One Vote Per User**: Each user can only have one vote per recipe
- **Score Calculation**: `score = upvotes - downvotes`
- **Discovery Ranking**: Recipes ordered by score DESC, then createdAt DESC

---

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Must be logged in to vote"
}
```

### 404 Not Found

```json
{
  "error": "Recipe not found"
}
```

### 400 Bad Request

```json
{
  "error": "Invalid vote type"
}
```

---

## Integration Examples

### React/TypeScript

```typescript
// Vote on a recipe
async function voteRecipe(recipeId: string, voteType: "upvote" | "downvote") {
  const response = await fetch(`/api/recipes/${recipeId}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ voteType }),
  });

  if (!response.ok) throw new Error("Failed to vote");
  return response.json();
}

// Remove vote
async function removeVote(recipeId: string) {
  const response = await fetch(`/api/recipes/${recipeId}/vote`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error("Failed to remove vote");
  return response.json();
}

// Toggle vote (upvote or remove)
async function toggleUpvote(recipeId: string, currentVote: string | null) {
  if (currentVote === "upvote") {
    return removeVote(recipeId);
  } else {
    return voteRecipe(recipeId, "upvote");
  }
}
```

### Swift/iOS

```swift
func voteRecipe(recipeId: String, voteType: String) async throws -> VoteResult {
    let url = URL(string: "https://api.example.com/api/recipes/\(recipeId)/vote")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = ["voteType": voteType]
    request.httpBody = try JSONEncoder().encode(body)

    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONDecoder().decode(VoteResult.self, from: data)
}
```

---

## Database Schema

### RecipeVote Table

```prisma
model RecipeVote {
  id        String   @id @default(uuid())
  recipeId  String
  userId    String
  voteType  VoteType // "upvote" or "downvote"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  recipe    Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([recipeId, userId])
  @@index([recipeId])
  @@index([userId])
  @@index([voteType])
}
```
