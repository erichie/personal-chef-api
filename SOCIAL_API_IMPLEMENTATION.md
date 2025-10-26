# Social Features API - Implementation Guide

## Overview

This guide provides complete implementation templates for all remaining social feature API endpoints. The database schema, TypeScript types, and utility functions are already complete.

## ✅ Already Implemented

1. **Database Schema** - All models created and migrated
2. **TypeScript Types** (`lib/types.ts`) - All social types added
3. **Utility Functions**:
   - `lib/friend-utils.ts` - Friend management helpers
   - `lib/post-utils.ts` - Post/comment/like helpers
   - `lib/feed-utils.ts` - Feed aggregation helpers

## 🔄 Remaining Implementation

### Friend Management Endpoints (7 files)

#### 1. POST /api/friends/send-request

**File:** `app/api/friends/send-request/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import {
  sendFriendRequest,
  findUserByFriendCode,
  searchUsers,
} from "@/lib/friend-utils";

const sendRequestSchema = z.object({
  friendId: z.string().optional(),
  email: z.string().email().optional(),
  friendCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const { friendId, email, friendCode } = sendRequestSchema.parse(body);

    let targetUserId: string;

    if (friendId) {
      targetUserId = friendId;
    } else if (friendCode) {
      const targetUser = await findUserByFriendCode(friendCode);
      if (!targetUser) {
        return NextResponse.json(
          { error: "User not found with this friend code" },
          { status: 404 }
        );
      }
      targetUserId = targetUser.id;
    } else if (email) {
      const users = await searchUsers(email, user.id);
      const targetUser = users.find((u) => u.email === email);
      if (!targetUser) {
        return NextResponse.json(
          { error: "User not found with this email" },
          { status: 404 }
        );
      }
      targetUserId = targetUser.id;
    } else {
      return NextResponse.json(
        { error: "Must provide friendId, email, or friendCode" },
        { status: 400 }
      );
    }

    const friendship = await sendFriendRequest(user.id, targetUserId);

    return NextResponse.json({ friendship });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 2. POST /api/friends/[friendshipId]/accept

**File:** `app/api/friends/[friendshipId]/accept/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { acceptFriendRequest } from "@/lib/friend-utils";
import { createFriendshipActivity } from "@/lib/feed-utils";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { friendshipId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { friendshipId } = params;

    const friendship = await acceptFriendRequest(friendshipId, user.id);

    // Get friend details for activity
    const friend = await prisma.user.findUnique({
      where: { id: friendship.userId },
      select: { displayName: true, email: true },
    });

    // Create friendship activity (private to current user)
    await createFriendshipActivity(
      user.id,
      friendship.userId,
      friend?.displayName || friend?.email
    );

    return NextResponse.json({ friendship });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 3. POST /api/friends/[friendshipId]/decline

**File:** `app/api/friends/[friendshipId]/decline/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { declineFriendRequest } from "@/lib/friend-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: { friendshipId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { friendshipId } = params;

    await declineFriendRequest(friendshipId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 4. DELETE /api/friends/[friendshipId]

**File:** `app/api/friends/[friendshipId]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { removeFriend } from "@/lib/friend-utils";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { friendshipId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { friendshipId } = params;

    await removeFriend(friendshipId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 5. GET /api/friends

**File:** `app/api/friends/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getFriendsList } from "@/lib/friend-utils";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as
      | "pending"
      | "accepted"
      | "blocked"
      | undefined;

    const friendships = await getFriendsList(user.id, status);

    // Separate into accepted and pending
    const friends = friendships.filter((f) => f.status === "accepted");
    const pendingRequests = friendships.filter((f) => f.status === "pending");

    return NextResponse.json({ friends, pendingRequests });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 6. POST /api/friends/search

**File:** `app/api/friends/search/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { searchUsers } from "@/lib/friend-utils";

const searchSchema = z.object({
  query: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const { query } = searchSchema.parse(body);

    const users = await searchUsers(query, user.id);

    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 7. POST /api/friends/find-by-code

**File:** `app/api/friends/find-by-code/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { findUserByFriendCode } from "@/lib/friend-utils";

const findByCodeSchema = z.object({
  friendCode: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request); // Must be authenticated
    const body = await request.json();
    const { friendCode } = findByCodeSchema.parse(body);

    const user = await findUserByFriendCode(friendCode);

    if (!user) {
      return NextResponse.json(
        { error: "User not found with this friend code" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

### Recipe Post Endpoints (7 files)

#### 8. POST /api/posts

**File:** `app/api/posts/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { createPost } from "@/lib/post-utils";

const createPostSchema = z.object({
  recipeId: z.string(),
  text: z.string().optional(),
  photoUrl: z.string().url().optional(),
  rating: z.number().min(1).max(5).optional(),
  review: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const data = createPostSchema.parse(body);

    const post = await createPost({
      userId: user.id,
      ...data,
    });

    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 9. GET /api/posts/[postId]

**File:** `app/api/posts/[postId]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getPostWithDetails } from "@/lib/post-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = params;

    const post = await getPostWithDetails(postId, user.id);

    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 10. PUT /api/posts/[postId]

**File:** Same file as above, add PUT handler

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = params;
    const body = await request.json();

    const updateSchema = z.object({
      text: z.string().optional(),
      photoUrl: z.string().url().optional(),
      rating: z.number().min(1).max(5).optional(),
      review: z.string().optional(),
    });

    const data = updateSchema.parse(body);
    const post = await updatePost(postId, user.id, data);

    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 11. DELETE /api/posts/[postId]

**File:** Same file, add DELETE handler

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = params;

    await deletePost(postId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 12. POST /api/posts/[postId]/like

**File:** `app/api/posts/[postId]/like/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { toggleLike } from "@/lib/post-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = params;

    const result = await toggleLike(postId, user.id);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 13. POST /api/posts/[postId]/comment

**File:** `app/api/posts/[postId]/comment/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { addComment } from "@/lib/post-utils";

const commentSchema = z.object({
  text: z.string().min(1).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = params;
    const body = await request.json();
    const { text } = commentSchema.parse(body);

    const comment = await addComment(postId, user.id, text);

    return NextResponse.json({ comment });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 14. DELETE /api/posts/[postId]/comment/[commentId]

**File:** `app/api/posts/[postId]/comment/[commentId]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { deleteComment } from "@/lib/post-utils";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { postId: string; commentId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { commentId } = params;

    await deleteComment(commentId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

### Feed Endpoints (2 files)

#### 15. GET /api/feed

**File:** `app/api/feed/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getFriendsFeed } from "@/lib/feed-utils";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor") || undefined;
    const type = (searchParams.get("type") || "all") as
      | "all"
      | "posts"
      | "meals"
      | "saves";

    const result = await getFriendsFeed(user.id, {
      limit,
      cursor,
      type,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### 16. GET /api/feed/user/[userId]

**File:** `app/api/feed/user/[userId]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getUserActivity } from "@/lib/feed-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { userId } = params;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor") || undefined;

    const result = await getUserActivity(userId, user.id, {
      limit,
      cursor,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Directory Structure to Create

```bash
# Friend endpoints
mkdir -p app/api/friends/send-request
mkdir -p app/api/friends/search
mkdir -p app/api/friends/find-by-code
mkdir -p app/api/friends/[friendshipId]/accept
mkdir -p app/api/friends/[friendshipId]/decline

# Post endpoints
mkdir -p app/api/posts
mkdir -p app/api/posts/[postId]/like
mkdir -p app/api/posts/[postId]/comment/[commentId]

# Feed endpoints
mkdir -p app/api/feed/user/[userId]
```

## Quick Implementation Steps

1. **Create all directories** (use commands above)
2. **Copy each template** into the corresponding `route.ts` file
3. **Add missing imports** where needed (updatePost, deletePost in posts/[postId]/route.ts)
4. **Test each endpoint** using the API examples below

## Testing Examples

```bash
# Send friend request by friend code
curl -X POST http://localhost:3000/api/friends/send-request \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"friendCode": "abc123"}'

# Accept friend request
curl -X POST http://localhost:3000/api/friends/{friendshipId}/accept \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create post
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipeId": "recipe-id",
    "text": "Just made this!",
    "rating": 5
  }'

# Get feed
curl -X GET "http://localhost:3000/api/feed?limit=20&type=all" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Next Session Checklist

When resuming implementation:

- [ ] Create all directory structures
- [ ] Implement all 16 endpoint files
- [ ] Add photo upload endpoint (optional - Phase 5)
- [ ] Update API_EXAMPLES.md with social endpoints
- [ ] Test all endpoints manually
- [ ] Verify friend privacy (can't see non-friend posts)
- [ ] Verify friend_added activities only visible to user

## Notes

- All utility functions are already implemented and tested
- Database schema is complete and migrated
- TypeScript types are all defined
- Just need to wire up the API routes
- Estimated time to implement: 30-45 minutes
