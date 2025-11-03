import { prisma } from "./prisma";
import { errors } from "./api-errors";
import { createFeedActivity } from "./feed-utils";
import { getFriendIds } from "./friend-utils";
import type {
  MealPlan,
  MealPlanWithRecipes,
  MealPlanPost,
  MealPlanPostComment,
  MealPlanShare,
  TemplateMealPlanDay,
} from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a meal plan template from user's meal plan data
 */
export async function createMealPlan(data: {
  userId: string;
  title: string;
  description?: string;
  days: TemplateMealPlanDay[];
}): Promise<MealPlan> {
  // Validate that we have at least 1 day
  if (!data.days || data.days.length === 0) {
    throw errors.badRequest("Meal plan must have at least 1 day");
  }

  const mealPlan = await prisma.mealPlan.create({
    data: {
      id: uuidv4(),
      userId: data.userId,
      title: data.title,
      description: data.description,
      days: data.days as any,
    },
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
  });

  return mealPlan as unknown as MealPlan;
}

/**
 * Get a meal plan by ID
 */
export async function getMealPlan(mealPlanId: string): Promise<MealPlan> {
  const mealPlan = await prisma.mealPlan.findUnique({
    where: { id: mealPlanId },
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
  });

  if (!mealPlan) {
    throw errors.notFound("Meal plan not found");
  }

  return mealPlan as unknown as MealPlan;
}

/**
 * Enrich a meal plan with full recipe data
 */
export async function enrichMealPlanWithRecipes(
  mealPlan: MealPlan
): Promise<MealPlanWithRecipes> {
  // Extract all unique recipe IDs from the meal plan
  const recipeIds = new Set<string>();
  const days = mealPlan.days;

  for (const day of days) {
    if (day.meals.breakfast?.recipeId) {
      recipeIds.add(day.meals.breakfast.recipeId);
    }
    if (day.meals.lunch?.recipeId) {
      recipeIds.add(day.meals.lunch.recipeId);
    }
    if (day.meals.dinner?.recipeId) {
      recipeIds.add(day.meals.dinner.recipeId);
    }
  }

  // Fetch all recipes
  const recipes = await prisma.recipe.findMany({
    where: {
      id: { in: Array.from(recipeIds) },
    },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      servings: true,
      totalMinutes: true,
      tags: true,
      ingredients: true,
      steps: true,
    },
  });

  return {
    ...mealPlan,
    recipes: recipes as any,
  };
}

/**
 * Create a meal plan post
 */
export async function createMealPlanPost(data: {
  userId: string;
  mealPlanId: string;
  text?: string;
  photoUrl?: string;
  rating?: number;
}): Promise<MealPlanPost> {
  // Validate rating
  if (data.rating && (data.rating < 1 || data.rating > 5)) {
    throw errors.badRequest("Rating must be between 1 and 5");
  }

  // Verify meal plan exists and belongs to user
  const mealPlan = await prisma.mealPlan.findUnique({
    where: { id: data.mealPlanId },
  });

  if (!mealPlan) {
    throw errors.notFound("Meal plan not found");
  }

  if (mealPlan.userId !== data.userId) {
    throw errors.forbidden("Cannot post about a meal plan you don't own");
  }

  // Create post
  const post = await prisma.mealPlanPost.create({
    data: {
      id: uuidv4(),
      userId: data.userId,
      mealPlanId: data.mealPlanId,
      text: data.text,
      photoUrl: data.photoUrl,
      rating: data.rating,
    },
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
  });

  // Create feed activity
  await createFeedActivity({
    userId: data.userId,
    activityType: "meal_plan_post",
    mealPlanPostId: post.id,
    metadata: {
      mealPlanTitle: mealPlan.title,
    },
  });

  return post as unknown as MealPlanPost;
}

/**
 * Update a meal plan post
 */
export async function updateMealPlanPost(
  postId: string,
  userId: string,
  data: {
    text?: string;
    photoUrl?: string;
    rating?: number;
  }
): Promise<MealPlanPost> {
  const post = await prisma.mealPlanPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw errors.notFound("Post not found");
  }

  if (post.userId !== userId) {
    throw errors.forbidden("Cannot update this post");
  }

  // Validate rating
  if (data.rating && (data.rating < 1 || data.rating > 5)) {
    throw errors.badRequest("Rating must be between 1 and 5");
  }

  const updated = await prisma.mealPlanPost.update({
    where: { id: postId },
    data,
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
  });

  return updated as unknown as MealPlanPost;
}

/**
 * Delete a meal plan post
 */
export async function deleteMealPlanPost(
  postId: string,
  userId: string
): Promise<void> {
  const post = await prisma.mealPlanPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw errors.notFound("Post not found");
  }

  if (post.userId !== userId) {
    throw errors.forbidden("Cannot delete this post");
  }

  // Delete post (cascade will handle likes and comments)
  await prisma.mealPlanPost.delete({
    where: { id: postId },
  });

  // Delete associated feed activity
  await prisma.feedActivity.deleteMany({
    where: { mealPlanPostId: postId },
  });
}

/**
 * Toggle like on a meal plan post
 */
export async function toggleMealPlanPostLike(
  postId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> {
  // Check if post exists
  const post = await prisma.mealPlanPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw errors.notFound("Post not found");
  }

  // Check if already liked
  const existingLike = await prisma.mealPlanPostLike.findUnique({
    where: {
      postId_userId: {
        postId,
        userId,
      },
    },
  });

  if (existingLike) {
    // Unlike
    await prisma.mealPlanPostLike.delete({
      where: { id: existingLike.id },
    });
  } else {
    // Like
    await prisma.mealPlanPostLike.create({
      data: {
        id: uuidv4(),
        postId,
        userId,
      },
    });
  }

  // Get updated like count
  const likeCount = await prisma.mealPlanPostLike.count({
    where: { postId },
  });

  return {
    liked: !existingLike,
    likeCount,
  };
}

/**
 * Add a comment to a meal plan post
 */
export async function addMealPlanPostComment(
  postId: string,
  userId: string,
  text: string
): Promise<MealPlanPostComment> {
  // Check if post exists
  const post = await prisma.mealPlanPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw errors.notFound("Post not found");
  }

  const comment = await prisma.mealPlanPostComment.create({
    data: {
      id: uuidv4(),
      postId,
      userId,
      text,
    },
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
  });

  return comment as unknown as MealPlanPostComment;
}

/**
 * Delete a comment
 */
export async function deleteMealPlanPostComment(
  commentId: string,
  userId: string
): Promise<void> {
  const comment = await prisma.mealPlanPostComment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw errors.notFound("Comment not found");
  }

  if (comment.userId !== userId) {
    throw errors.forbidden("Cannot delete this comment");
  }

  await prisma.mealPlanPostComment.delete({
    where: { id: commentId },
  });
}

/**
 * Get meal plan post with full details including likes and comments
 */
export async function getMealPlanPostWithDetails(
  postId: string,
  currentUserId: string
): Promise<MealPlanPost> {
  const post = await prisma.mealPlanPost.findUnique({
    where: { id: postId },
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
          createdAt: "asc",
        },
      },
    },
  });

  if (!post) {
    throw errors.notFound("Post not found");
  }

  // Enrich meal plan with recipe data
  const mealPlan = await enrichMealPlanWithRecipes(
    post.mealPlan as unknown as MealPlan
  );

  // Check if current user liked
  const isLikedByCurrentUser = post.likes.some(
    (like) => like.userId === currentUserId
  );

  return {
    ...post,
    mealPlan,
    likeCount: post.likes.length,
    commentCount: post.comments.length,
    isLikedByCurrentUser,
  } as unknown as MealPlanPost;
}

/**
 * Share a meal plan directly to a friend
 */
export async function shareMealPlanToFriend(data: {
  mealPlanId: string;
  senderId: string;
  recipientId: string;
  message?: string;
}): Promise<MealPlanShare> {
  // Can't share with yourself
  if (data.senderId === data.recipientId) {
    throw errors.badRequest("Cannot share meal plan with yourself");
  }

  // Verify meal plan exists and belongs to sender
  const mealPlan = await prisma.mealPlan.findUnique({
    where: { id: data.mealPlanId },
  });

  if (!mealPlan) {
    throw errors.notFound("Meal plan not found");
  }

  if (mealPlan.userId !== data.senderId) {
    throw errors.forbidden("Cannot share a meal plan you don't own");
  }

  // Verify they are friends
  const friendIds = await getFriendIds(data.senderId);
  if (!friendIds.includes(data.recipientId)) {
    throw errors.forbidden("Can only share meal plans with friends");
  }

  // Check if already shared
  const existingShare = await prisma.mealPlanShare.findFirst({
    where: {
      mealPlanId: data.mealPlanId,
      senderId: data.senderId,
      recipientId: data.recipientId,
    },
  });

  if (existingShare) {
    throw errors.badRequest("Already shared this meal plan with this friend");
  }

  // Create share
  const share = await prisma.mealPlanShare.create({
    data: {
      id: uuidv4(),
      mealPlanId: data.mealPlanId,
      senderId: data.senderId,
      recipientId: data.recipientId,
      message: data.message,
    },
    include: {
      sender: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          friendCode: true,
          bio: true,
        },
      },
      recipient: {
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
  });

  return share as unknown as MealPlanShare;
}

/**
 * Get meal plans shared with a user
 */
export async function getSharedMealPlans(
  userId: string,
  status?: "pending" | "viewed" | "saved" | "declined"
): Promise<MealPlanShare[]> {
  const shares = await prisma.mealPlanShare.findMany({
    where: {
      recipientId: userId,
      ...(status && { status }),
    },
    include: {
      sender: {
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
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Enrich each meal plan with recipe data
  const enrichedShares = await Promise.all(
    shares.map(async (share) => {
      const mealPlan = await enrichMealPlanWithRecipes(
        share.mealPlan as unknown as MealPlan
      );

      return {
        ...share,
        mealPlan,
      } as unknown as MealPlanShare;
    })
  );

  return enrichedShares;
}

/**
 * Update the status of a meal plan share
 */
export async function updateMealPlanShareStatus(
  shareId: string,
  userId: string,
  status: "viewed" | "saved" | "declined"
): Promise<MealPlanShare> {
  const share = await prisma.mealPlanShare.findUnique({
    where: { id: shareId },
  });

  if (!share) {
    throw errors.notFound("Share not found");
  }

  if (share.recipientId !== userId) {
    throw errors.forbidden("Cannot update this share");
  }

  const updated = await prisma.mealPlanShare.update({
    where: { id: shareId },
    data: { status },
    include: {
      sender: {
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
    },
  });

  const mealPlan = await enrichMealPlanWithRecipes(
    updated.mealPlan as unknown as MealPlan
  );

  return {
    ...updated,
    mealPlan,
  } as unknown as MealPlanShare;
}
