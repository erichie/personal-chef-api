import { prisma } from "./prisma";
import { errors } from "./api-errors";
import { getFriendIds } from "./friend-utils";
import type { FeedActivity, MealPlan } from "./types";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";

/**
 * Create a feed activity
 */
export async function createFeedActivity(data: {
  userId: string;
  activityType:
    | "post"
    | "basic_post"
    | "meal_plan_post"
    | "recipe_saved"
    | "friend_added";
  postId?: string;
  basicPostId?: string;
  recipeId?: string;
  mealPlanPostId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.feedActivity.create({
    data: {
      id: uuidv4(),
      userId: data.userId,
      activityType: data.activityType,
      postId: data.postId,
      basicPostId: data.basicPostId,
      recipeId: data.recipeId,
      mealPlanPostId: data.mealPlanPostId,
      metadata:
        data.metadata !== undefined && data.metadata !== null
          ? (data.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
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
      ? ["post", "basic_post"]
      : type === "meals"
      ? ["meal_plan_post"]
      : type === "saves"
      ? ["recipe_saved"]
      : ["post", "basic_post", "meal_plan_post", "recipe_saved", "friend_added"];

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

  // Enrich activities with post, meal plan post, and recipe details
  const enrichedActivities = await Promise.all(
    results.map(async (activity) => {
      let post: FeedActivity["post"] = undefined;
      let recipe = null;
      let mealPlanPost = null;
      if (activity.basicPostId) {
        const basicPost = await prisma.basicPost.findUnique({
          where: { id: activity.basicPostId },
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
            likes: {
              select: {
                userId: true,
              },
            },
            comments: {
              select: {
                id: true,
              },
            },
          },
        });

        if (basicPost) {
          const isLikedByCurrentUser = basicPost.likes.some(
            (like) => like.userId === userId
          );

          post = {
            ...basicPost,
            text: basicPost.text ?? undefined,
            photoUrl: basicPost.photoUrl ?? undefined,
            user: basicPost.user
              ? {
                  ...basicPost.user,
                  displayName: basicPost.user.displayName ?? undefined,
                  email: basicPost.user.email ?? undefined,
                  friendCode: basicPost.user.friendCode ?? undefined,
                  bio: basicPost.user.bio ?? undefined,
                  avatarUrl: basicPost.user.avatarUrl ?? undefined,
                }
              : undefined,
            likeCount: basicPost.likes.length,
            commentCount: basicPost.comments.length,
            isLikedByCurrentUser,
          };
        }
      }


      if (activity.postId) {
        const recipePost = await prisma.recipePost.findUnique({
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
            recipe: true, // Include ALL recipe data (ingredients, steps, etc.)
            likes: {
              select: {
                userId: true,
              },
            },
            comments: {
              select: {
                id: true,
              },
            },
          },
        });

        if (recipePost) {
          // Check if current user liked
          const isLikedByCurrentUser = recipePost.likes.some(
            (like) => like.userId === userId
          );
          post = {
            ...recipePost,
            text: recipePost.text ?? undefined,
            photoUrl: recipePost.photoUrl ?? undefined,
            rating: recipePost.rating ?? undefined,
            review: recipePost.review ?? undefined,
            user: recipePost.user
              ? {
                  ...recipePost.user,
                  displayName: recipePost.user.displayName ?? undefined,
                  email: recipePost.user.email ?? undefined,
                  friendCode: recipePost.user.friendCode ?? undefined,
                  bio: recipePost.user.bio ?? undefined,
                  avatarUrl: recipePost.user.avatarUrl ?? undefined,
                }
              : undefined,
            likeCount: recipePost.likes.length,
            commentCount: recipePost.comments.length,
            isLikedByCurrentUser,
          };
        }
      }

      if (activity.mealPlanPostId) {
        const mealPlanPostData = await prisma.mealPlanPost.findUnique({
          where: { id: activity.mealPlanPostId },
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
            mealPlan: {
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
            },
            likes: {
              select: {
                userId: true,
              },
            },
            comments: {
              select: {
                id: true,
              },
            },
          },
        });

        if (mealPlanPostData) {
          // Enrich meal plan with full recipe data
          const { enrichMealPlanWithRecipes } = await import(
            "./meal-plan-utils"
          );
          const enrichedMealPlan = await enrichMealPlanWithRecipes(
            mealPlanPostData.mealPlan as unknown as MealPlan
          );

          // Check if current user liked
          const isLikedByCurrentUser = mealPlanPostData.likes.some(
            (like) => like.userId === userId
          );

          mealPlanPost = {
            ...mealPlanPostData,
            mealPlan: enrichedMealPlan,
            likeCount: mealPlanPostData.likes.length,
            commentCount: mealPlanPostData.comments.length,
            isLikedByCurrentUser,
          };
        }
      }

      if (activity.recipeId) {
        recipe = await prisma.recipe.findUnique({
          where: { id: activity.recipeId },
        });
      }

      return {
        id: activity.id,
        userId: activity.userId,
        activityType: activity.activityType,
        postId: activity.postId,
        basicPostId: activity.basicPostId,
        recipeId: activity.recipeId,
        mealPlanPostId: activity.mealPlanPostId,
        metadata: activity.metadata as Record<string, unknown>,
        createdAt: activity.createdAt,
        user: activity.user,
        post: post as unknown,
        recipe: recipe as unknown,
        mealPlanPost: mealPlanPost as unknown,
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
      let post: FeedActivity["post"] = undefined;
      let recipe = null;
      let mealPlanPost = null;
      if (activity.basicPostId) {
        const basicPost = await prisma.basicPost.findUnique({
          where: { id: activity.basicPostId },
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
            likes: {
              select: {
                userId: true,
              },
            },
            comments: {
              select: {
                id: true,
              },
            },
          },
        });

        if (basicPost) {
          const isLikedByCurrentUser = basicPost.likes.some(
            (like) => like.userId === currentUserId
          );

          post = {
            ...basicPost,
            text: basicPost.text ?? undefined,
            photoUrl: basicPost.photoUrl ?? undefined,
            user: basicPost.user
              ? {
                  ...basicPost.user,
                  displayName: basicPost.user.displayName ?? undefined,
                  email: basicPost.user.email ?? undefined,
                  friendCode: basicPost.user.friendCode ?? undefined,
                  bio: basicPost.user.bio ?? undefined,
                  avatarUrl: basicPost.user.avatarUrl ?? undefined,
                }
              : undefined,
            likeCount: basicPost.likes.length,
            commentCount: basicPost.comments.length,
            isLikedByCurrentUser,
          };
        }
      }


      if (activity.postId) {
        const recipePost = await prisma.recipePost.findUnique({
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
            recipe: true, // Include ALL recipe data (ingredients, steps, etc.)
            likes: {
              select: {
                userId: true,
              },
            },
            comments: {
              select: {
                id: true,
              },
            },
          },
        });

        if (recipePost) {
          const isLikedByCurrentUser = recipePost.likes.some(
            (like) => like.userId === currentUserId
          );
          post = {
            ...recipePost,
            text: recipePost.text ?? undefined,
            photoUrl: recipePost.photoUrl ?? undefined,
            rating: recipePost.rating ?? undefined,
            review: recipePost.review ?? undefined,
            user: recipePost.user
              ? {
                  ...recipePost.user,
                  displayName: recipePost.user.displayName ?? undefined,
                  email: recipePost.user.email ?? undefined,
                  friendCode: recipePost.user.friendCode ?? undefined,
                  bio: recipePost.user.bio ?? undefined,
                  avatarUrl: recipePost.user.avatarUrl ?? undefined,
                }
              : undefined,
            likeCount: recipePost.likes.length,
            commentCount: recipePost.comments.length,
            isLikedByCurrentUser,
          };
        }
      }

      if (activity.mealPlanPostId) {
        const mealPlanPostData = await prisma.mealPlanPost.findUnique({
          where: { id: activity.mealPlanPostId },
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
            mealPlan: {
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
            },
            likes: {
              select: {
                userId: true,
              },
            },
            comments: {
              select: {
                id: true,
              },
            },
          },
        });

        if (mealPlanPostData) {
          // Enrich meal plan with full recipe data
          const { enrichMealPlanWithRecipes } = await import(
            "./meal-plan-utils"
          );
          const enrichedMealPlan = await enrichMealPlanWithRecipes(
            mealPlanPostData.mealPlan as unknown as MealPlan
          );

          const isLikedByCurrentUser = mealPlanPostData.likes.some(
            (like) => like.userId === currentUserId
          );

          mealPlanPost = {
            ...mealPlanPostData,
            mealPlan: enrichedMealPlan,
            likeCount: mealPlanPostData.likes.length,
            commentCount: mealPlanPostData.comments.length,
            isLikedByCurrentUser,
          };
        }
      }

      if (activity.recipeId) {
        recipe = await prisma.recipe.findUnique({
          where: { id: activity.recipeId },
        });
      }

      return {
        id: activity.id,
        userId: activity.userId,
        activityType: activity.activityType,
        postId: activity.postId,
        basicPostId: activity.basicPostId,
        recipeId: activity.recipeId,
        mealPlanPostId: activity.mealPlanPostId,
        metadata: activity.metadata as Record<string, unknown>,
        createdAt: activity.createdAt,
        user: activity.user,
        post: post as unknown,
        recipe: recipe as unknown,
        mealPlanPost: mealPlanPost as unknown,
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
