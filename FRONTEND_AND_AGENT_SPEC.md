## Social Features Frontend Implementation Guide and LLM Agent Build Spec

### Overview

- Implement friends, posts (text/photo/rating/review), likes, comments, and a friends-only activity feed.
- All endpoints require `Authorization: Bearer {sessionToken}`.
- Privacy: Only friends see activity; `friend_added` appears only in your own feed.

---

## Frontend Implementation Guide

### Authentication on the Client

- Obtain and persist a session token from your existing auth flows.
  - Guest flow: call `/api/auth/guest` once per device; store `token`.
  - Logged-in flow: derive `token` from your auth/session state.
- Include the token on every request.

```ts
// api/client.ts
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("pc_token"); // or your app state
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) throw new Error((await res.json())?.error || "Request failed");
  return res.json();
}
```

### Minimal Client Types

```ts
export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";

export interface UserBasic {
  id: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  friendCode?: string;
  bio?: string;
}

export interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
  friend: UserBasic;
}

export interface RecipeBasic {
  id: string;
  title: string;
  description?: string;
  servings?: number;
  totalMinutes?: number;
  tags?: string[];
}

export interface RecipePost {
  id: string;
  userId: string;
  recipeId: string;
  text?: string;
  photoUrl?: string;
  rating?: number;
  review?: string;
  createdAt: string;
  updatedAt: string;
  user?: UserBasic;
  recipe?: RecipeBasic;
  likeCount?: number;
  commentCount?: number;
  isLikedByCurrentUser?: boolean;
}

export interface FeedActivity {
  id: string;
  userId: string;
  activityType: "post" | "meal_plan" | "recipe_saved" | "friend_added";
  postId?: string;
  recipeId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  user: UserBasic;
  post?: RecipePost;
  recipe?: RecipeBasic;
}
```

### API Endpoints to Call (Summary)

- Friends
  - POST `/api/friends/send-request` { friendId? | email? | friendCode? }
  - POST `/api/friends/[friendshipId]/accept`
  - POST `/api/friends/[friendshipId]/decline`
  - DELETE `/api/friends/[friendshipId]`
  - GET `/api/friends?status=pending|accepted|blocked` → `{ friends, pendingRequests }`
  - POST `/api/friends/search` { query }
  - POST `/api/friends/find-by-code` { friendCode }
- Posts
  - POST `/api/posts` { recipeId, text?, photoUrl?, rating?, review? }
  - GET `/api/posts/[postId]`
  - PUT `/api/posts/[postId]` { text?, photoUrl?, rating?, review? }
  - DELETE `/api/posts/[postId]`
  - POST `/api/posts/[postId]/like`
  - POST `/api/posts/[postId]/comment` { text }
  - DELETE `/api/posts/[postId]/comment/[commentId]`
- Feed
  - GET `/api/feed?limit=20&cursor=&type=all|posts|meals|saves` → `{ activities, nextCursor }`
  - GET `/api/feed/user/[userId]?limit=20&cursor=`

### Client Data Hooks (Examples)

```ts
// friends/hooks.ts
export async function getFriends(status?: "pending" | "accepted" | "blocked") {
  const qs = status ? `?status=${status}` : "";
  return api<{ friends: Friendship[]; pendingRequests: Friendship[] }>(
    `/api/friends${qs}`
  );
}

export async function sendFriendRequest(payload: {
  friendId?: string;
  email?: string;
  friendCode?: string;
}) {
  return api<{ friendship: Friendship }>(`/api/friends/send-request`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function acceptFriendship(friendshipId: string) {
  return api<{ friendship: Friendship }>(
    `/api/friends/${friendshipId}/accept`,
    { method: "POST" }
  );
}
```

```ts
// posts/hooks.ts
export async function createPost(data: {
  recipeId: string;
  text?: string;
  photoUrl?: string;
  rating?: number;
  review?: string;
}) {
  return api<{ post: RecipePost }>(`/api/posts`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleLike(postId: string) {
  return api<{ liked: boolean; likeCount: number }>(
    `/api/posts/${postId}/like`,
    { method: "POST" }
  );
}

export async function addComment(postId: string, text: string) {
  return api<{ comment: { id: string } }>(`/api/posts/${postId}/comment`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
```

```ts
// feed/hooks.ts
export async function getFeed(params?: {
  limit?: number;
  cursor?: string;
  type?: "all" | "posts" | "meals" | "saves";
}) {
  const p = new URLSearchParams();
  if (params?.limit) p.set("limit", String(params.limit));
  if (params?.cursor) p.set("cursor", params.cursor);
  if (params?.type) p.set("type", params.type);
  const qs = p.toString() ? `?${p.toString()}` : "";
  return api<{ activities: FeedActivity[]; nextCursor: string | null }>(
    `/api/feed${qs}`
  );
}
```

### UI Flows to Implement

- Friends
  - Search by email/name; find-by-code input
  - Send request; view pending incoming/outgoing; accept/decline; remove
- Posts
  - Create post from a recipe: text/photo/rating/review → submit
  - View post: like count, comments list; like/unlike; add/delete own comment; edit/delete own post
- Feed
  - Infinite scroll with `cursor`; filter by `type`
  - Only show `friend_added` where `activity.userId === currentUserId`
- States
  - Empty (CTAs), loading (skeletons), error (toasts)

### Component Checklist

- Friends: FriendsList, PendingRequestsList, FriendSearch, FriendCodeInput, FriendRow
- Posts: CreatePostForm, PostCard, LikeButton, CommentList, CommentForm
- Feed: FeedList (virtualized), FeedItem variants for post/meal_plan/recipe_saved/friend_added
- Shared: Avatar, UserInline, RelativeTime, TagList, RatingStars, ImageWithFallback

### Client-Side Permissions & Privacy

- Hide edit/delete for posts not owned by current user.
- Hide comment delete unless `comment.userId === currentUserId`.
- Never render `friend_added` from others.
- Server enforces privacy; UI should still avoid exposing restricted actions.

### Performance Notes

- Infinite scroll with `nextCursor`.
- Virtualize lists; cache GETs with SWR/React Query; include token in cache key.
- Optimistic UI for likes/comments; rollback on error.

### Error Handling

- Standardize toasts; parse 400 Zod errors for inline messages.
- Handle 409 (duplicate friend request), 401/403 gracefully.

---

## LLM Agent Build Spec

### Product Requirements

- Features: friends (request/accept/decline/remove, search, friend code), posts (create/update/delete/like/comment), feed (infinite scroll, filters).
- Privacy: friends-only; `friend_added` visible only to the acting user.
- Auth: every request includes `Authorization: Bearer {token}`.

### API Contract (Backend Provided)

- Exact endpoints, inputs, and outputs are listed above and implemented in backend.
- Responses:
  - Friends: `{ friends, pendingRequests }`
  - Feed: `{ activities, nextCursor }`
  - Likes: `{ liked, likeCount }`
- Pagination: `limit`, `cursor`; Filtering: `type`.

### UI Acceptance Criteria

- Friends: send via email/code; list accepted and pending; accept/decline/remove.
- Posts: create with rating/review; like toggle updates count and state; comments list; delete own comment; edit/delete own post.
- Feed: infinite scroll; filter; `friend_added` only shown to the acting user; privacy enforced.

### State Management Strategy

- React Query/SWR for GETs; small wrappers for mutations.
- Token persisted in storage; rehydrate on load; inject into headers consistently.
- Optimistic updates for likes/comments.

### Component Plan

- Build components listed in the checklist; keep data hooks separate from presentation.
- Ensure accessibility (labels, keyboard, focus, alt text for images).

### Tasks / Implementation Order

1. Auth bootstrap: token storage and header injector.
2. API client + hooks (friends, posts, feed).
3. Friends pages: list, search, friend code, pending actions.
4. Post creation + post detail (likes/comments).
5. Feed page with infinite scroll and filters.
6. Edge states, error handling, loading skeletons.
7. Accessibility pass and tests.

### Testing Plan

- Integration tests per endpoint happy/negative paths.
- E2E: friend flow (request→accept), post flow (create/like/comment), feed renders and paginates.
- Visual snapshots for FeedItem variants.

### Non-Goals (Current Scope)

- Photo upload endpoint (optional next phase; suggest Vercel Blob + signed URLs).
- Real-time updates (polling or refresh acceptable for now).

---

## References to Backend Docs

- `SOCIAL_API_IMPLEMENTATION.md` – Copy-paste endpoint templates and examples
- `SOCIAL_FEATURES_SUMMARY.md` – Architecture and data flow
- `API_ENDPOINT_MAP.md` – API structure overview
- `SOCIAL_FEATURES_COMPLETE.md` – End-to-end testing guide
- `fu.plan.md` – Original feature plan and schema details

### Quick Test Commands (cURL)

```bash
# Send friend request by friend code
curl -X POST http://localhost:3000/api/friends/send-request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"friendCode": "abc123"}'

# Accept friend request
curl -X POST http://localhost:3000/api/friends/{friendshipId}/accept \
  -H "Authorization: Bearer $TOKEN"

# Create post
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"recipe-id","text":"Just made this!","rating":5}'

# Get feed
curl -X GET "http://localhost:3000/api/feed?limit=20&type=all" \
  -H "Authorization: Bearer $TOKEN"
```
