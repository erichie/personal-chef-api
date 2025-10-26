import { prisma } from "./prisma";
import { errors } from "./api-errors";
import { createFeedActivity } from "./feed-utils";
import type { RecipePost, PostComment } from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a recipe post
 */
export async function createPost(data: {
  userId: string;
  recipeId: string;
  text?: string;
  photoUrl?: string;
  rating?: number;
  review?: string;
}): Promise<RecipePost> {
  // Validate rating
  if (data.rating && (data.rating < 1 || data.rating > 5)) {
    throw errors.badRequest("Rating must be between 1 and 5");
  }

  // Verify recipe exists and belongs to user
  const recipe = await prisma.recipe.findUnique({
    where: { id: data.recipeId },
  });

  if (!recipe) {
    throw errors.notFound("Recipe not found");
  }

  if (recipe.userId !== data.userId) {
    throw errors.forbidden("Cannot post about a recipe you don't own");
  }

  // Create post
  const post = await prisma.recipePost.create({
    data: {
      id: uuidv4(),
      userId: data.userId,
      recipeId: data.recipeId,
      text: data.text,
      photoUrl: data.photoUrl,
      rating: data.rating,
      review: data.review,
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
    },
  });

  // Create feed activity
  await createFeedActivity({
    userId: data.userId,
    activityType: "post",
    postId: post.id,
    metadata: {
      recipeTitle: recipe.title,
    },
  });

  return post as unknown as RecipePost;
}

/**
 * Update a recipe post
 */
export async function updatePost(
  postId: string,
  userId: string,
  data: {
    text?: string;
    photoUrl?: string;
    rating?: number;
    review?: string;
  }
): Promise<RecipePost> {
  const post = await prisma.recipePost.findUnique({
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

  const updated = await prisma.recipePost.update({
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
    },
  });

  return updated as unknown as RecipePost;
}

/**
 * Delete a recipe post
 */
export async function deletePost(
  postId: string,
  userId: string
): Promise<void> {
  const post = await prisma.recipePost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw errors.notFound("Post not found");
  }

  if (post.userId !== userId) {
    throw errors.forbidden("Cannot delete this post");
  }

  // Delete post (cascade will handle likes and comments)
  await prisma.recipePost.delete({
    where: { id: postId },
  });

  // Delete associated feed activity
  await prisma.feedActivity.deleteMany({
    where: { postId },
  });
}

/**
 * Toggle like on a post
 */
export async function toggleLike(
  postId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> {
  // Check if post exists
  const post = await prisma.recipePost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw errors.notFound("Post not found");
  }

  // Check if already liked
  const existingLike = await prisma.postLike.findUnique({
    where: {
      postId_userId: {
        postId,
        userId,
      },
    },
  });

  if (existingLike) {
    // Unlike
    await prisma.postLike.delete({
      where: { id: existingLike.id },
    });
  } else {
    // Like
    await prisma.postLike.create({
      data: {
        id: uuidv4(),
        postId,
        userId,
      },
    });
  }

  // Get updated like count
  const likeCount = await prisma.postLike.count({
    where: { postId },
  });

  return {
    liked: !existingLike,
    likeCount,
  };
}

/**
 * Add a comment to a post
 */
export async function addComment(
  postId: string,
  userId: string,
  text: string
): Promise<PostComment> {
  // Check if post exists
  const post = await prisma.recipePost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw errors.notFound("Post not found");
  }

  const comment = await prisma.postComment.create({
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

  return comment as unknown as PostComment;
}

/**
 * Delete a comment
 */
export async function deleteComment(
  commentId: string,
  userId: string
): Promise<void> {
  const comment = await prisma.postComment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw errors.notFound("Comment not found");
  }

  if (comment.userId !== userId) {
    throw errors.forbidden("Cannot delete this comment");
  }

  await prisma.postComment.delete({
    where: { id: commentId },
  });
}

/**
 * Get post with full details including likes and comments
 */
export async function getPostWithDetails(
  postId: string,
  currentUserId: string
): Promise<RecipePost> {
  const post = await prisma.recipePost.findUnique({
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

  // Check if current user liked
  const isLikedByCurrentUser = post.likes.some(
    (like) => like.userId === currentUserId
  );

  return {
    ...post,
    likeCount: post.likes.length,
    commentCount: post.comments.length,
    isLikedByCurrentUser,
  } as unknown as RecipePost;
}
