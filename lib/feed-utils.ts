import { prisma } from "./prisma";
import { errors } from "./api-errors";
import { getFriendIds } from "./friend-utils";
import type { FeedActivity } from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a feed activity
 */
export async function createFeedActivity(data: {
  userId: string;
  activityType: "post" | "meal_plan" | "recipe_saved" | "friend_added";
  postId?: string;
  recipeId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.feedActivity.create({
    data: {
      id: uuidv4(),
      userId: data.userId,
      activityType: data.activityType,
      postId: data.postId,
      recipeId: data.recipeId,
      metadata: data.metadata || {},
    },
  });
}

/**
 * Get aggregated feed for a user
 * Shows friends' activities + user's own friend_added activities
 */
export async function getFriendsFeed(
  userId: string,
  options: {
    limit?: number;
    cursor?: string;
    type?: "all" | "posts" | "meals" | "saves";
  } = {}
): Promise<{ activities: FeedActivity[]; nextCursor: string | null }> {
  const limit = options.limit || 20;
  const { cursor, type } = options;

  // Get friend IDs
  const friendIds = await getFriendIds(userId);

  // Build activity type filter
  const activityTypeFilter =
    type === "posts"
      ? ["post"]
      : type === "meals"
      ? ["meal_plan"]
      : type === "saves"
      ? ["recipe_saved"]
      : ["post", "meal_plan", "recipe_saved", "friend_added"];

  // Build where clause
  const where = {
    AND: [
      {
        OR: [
          // Friends' activities (exclude friend_added)
          {
            userId: { in: friendIds },
            activityType: {
              in: activityTypeFilter.filter((t) => t !== "friend_added"),
            },
          },
          // User's own friend_added activities (private to them)
          {
            userId,
            activityType: "friend_added",
          },
        ],
      },
      // Cursor pagination
      cursor
        ? {
            createdAt: {
              lt: new Date(cursor),
            },
          }
        : {},
    ],
  };

  // Fetch activities
  const activities = await prisma.feedActivity.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          friendCode: true,
          bio: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit + 1, // Fetch one extra to determine if there's a next page
  });

  // Determine if there's a next page
  const hasMore = activities.length > limit;
  const results = hasMore ? activities.slice(0, limit) : activities;
  const nextCursor = hasMore
    ? results[results.length - 1].createdAt.toISOString()
    : null;

  // Enrich activities with post and recipe details
  const enrichedActivities = await Promise.all(
    results.map(async (activity) => {
      let post = null;
      let recipe = null;

      if (activity.postId) {
        post = await prisma.recipePost.findUnique({
          where: { id: activity.postId },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true,
                avatarUrl: true,
                friendCode: true,
                bio: true,
              },
            },
            recipe: {
              select: {
                id: true,
                title: true,
                description: true,
                servings: true,
                totalMinutes: true,
                tags: true,
              },
            },
            likes: {
              select: {
                userId: true,
              },
            },
          },
        });

        if (post) {
          // Check if current user liked
          const isLikedByCurrentUser = post.likes.some(
            (like) => like.userId === userId
          );
          post = {
            ...post,
            likeCount: post.likes.length,
            isLikedByCurrentUser,
          };
        }
      }

      if (activity.recipeId) {
        recipe = await prisma.recipe.findUnique({
          where: { id: activity.recipeId },
          select: {
            id: true,
            title: true,
            description: true,
            servings: true,
            totalMinutes: true,
            tags: true,
          },
        });
      }

      return {
        id: activity.id,
        userId: activity.userId,
        activityType: activity.activityType,
        postId: activity.postId,
        recipeId: activity.recipeId,
        metadata: activity.metadata as Record<string, unknown>,
        createdAt: activity.createdAt,
        user: activity.user,
        post: post as unknown,
        recipe: recipe as unknown,
      } as FeedActivity;
    })
  );

  return {
    activities: enrichedActivities,
    nextCursor,
  };
}

/**
 * Get activity feed for a specific user (must be friends)
 */
export async function getUserActivity(
  targetUserId: string,
  currentUserId: string,
  options: {
    limit?: number;
    cursor?: string;
  } = {}
): Promise<{ activities: FeedActivity[]; nextCursor: string | null }> {
  // Check if they're friends (or viewing own profile)
  if (targetUserId !== currentUserId) {
    const friendIds = await getFriendIds(currentUserId);
    if (!friendIds.includes(targetUserId)) {
      throw errors.forbidden("Can only view friends' activity");
    }
  }

  const limit = options.limit || 20;
  const { cursor } = options;

  // Build where clause
  const where = {
    userId: targetUserId,
    // Exclude friend_added if not viewing own profile
    ...(targetUserId !== currentUserId && {
      activityType: { not: "friend_added" },
    }),
    ...(cursor && {
      createdAt: {
        lt: new Date(cursor),
      },
    }),
  };

  const activities = await prisma.feedActivity.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          friendCode: true,
          bio: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit + 1,
  });

  // Determine if there's a next page
  const hasMore = activities.length > limit;
  const results = hasMore ? activities.slice(0, limit) : activities;
  const nextCursor = hasMore
    ? results[results.length - 1].createdAt.toISOString()
    : null;

  // Enrich activities
  const enrichedActivities = await Promise.all(
    results.map(async (activity) => {
      let post = null;
      let recipe = null;

      if (activity.postId) {
        post = await prisma.recipePost.findUnique({
          where: { id: activity.postId },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true,
                avatarUrl: true,
                friendCode: true,
                bio: true,
              },
            },
            recipe: {
              select: {
                id: true,
                title: true,
                description: true,
                servings: true,
                totalMinutes: true,
                tags: true,
              },
            },
            likes: {
              select: {
                userId: true,
              },
            },
          },
        });

        if (post) {
          const isLikedByCurrentUser = post.likes.some(
            (like) => like.userId === currentUserId
          );
          post = {
            ...post,
            likeCount: post.likes.length,
            isLikedByCurrentUser,
          };
        }
      }

      if (activity.recipeId) {
        recipe = await prisma.recipe.findUnique({
          where: { id: activity.recipeId },
          select: {
            id: true,
            title: true,
            description: true,
            servings: true,
            totalMinutes: true,
            tags: true,
          },
        });
      }

      return {
        id: activity.id,
        userId: activity.userId,
        activityType: activity.activityType,
        postId: activity.postId,
        recipeId: activity.recipeId,
        metadata: activity.metadata as Record<string, unknown>,
        createdAt: activity.createdAt,
        user: activity.user,
        post: post as unknown,
        recipe: recipe as unknown,
      } as FeedActivity;
    })
  );

  return {
    activities: enrichedActivities,
    nextCursor,
  };
}

/**
 * Create a friendship activity (private to user only)
 */
export async function createFriendshipActivity(
  userId: string,
  friendId: string,
  friendName?: string
): Promise<void> {
  await createFeedActivity({
    userId,
    activityType: "friend_added",
    metadata: {
      friendId,
      friendName: friendName || "A friend",
    },
  });
}
