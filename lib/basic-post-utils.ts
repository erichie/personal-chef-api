import { prisma } from "./prisma";
import { errors } from "./api-errors";
import type { BasicPost, BasicPostComment } from "./types";
import { v4 as uuidv4 } from "uuid";

export async function getBasicPostWithDetails(
  postId: string,
  currentUserId: string
): Promise<BasicPost> {
  const post = await prisma.basicPost.findUnique({
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

  const isLikedByCurrentUser = post.likes.some(
    (like) => like.userId === currentUserId
  );

  return {
    ...post,
    text: post.text ?? undefined,
    photoUrl: post.photoUrl ?? undefined,
    user: post.user
      ? {
        ...post.user,
        displayName: post.user.displayName ?? undefined,
        email: post.user.email ?? undefined,
        friendCode: post.user.friendCode ?? undefined,
        bio: post.user.bio ?? undefined,
        avatarUrl: post.user.avatarUrl ?? undefined,
      }
      : undefined,
    likeCount: post.likes.length,
    commentCount: post.comments.length,
    isLikedByCurrentUser,
    comments: post.comments.map((comment) => ({
      ...comment,
      user: comment.user
        ? {
          ...comment.user,
          displayName: comment.user.displayName ?? undefined,
          email: comment.user.email ?? undefined,
          friendCode: comment.user.friendCode ?? undefined,
          bio: comment.user.bio ?? undefined,
          avatarUrl: comment.user.avatarUrl ?? undefined,
        }
        : undefined,
    })),
  } as BasicPost;
}

export async function toggleBasicPostLike(
  postId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const post = await prisma.basicPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw errors.notFound("Post not found");
  }

  const existingLike = await prisma.basicPostLike.findUnique({
    where: {
      postId_userId: {
        postId,
        userId,
      },
    },
  });

  if (existingLike) {
    await prisma.basicPostLike.delete({
      where: { id: existingLike.id },
    });
  } else {
    await prisma.basicPostLike.create({
      data: {
        id: uuidv4(),
        postId,
        userId,
      },
    });
  }

  const likeCount = await prisma.basicPostLike.count({
    where: { postId },
  });

  return {
    liked: !existingLike,
    likeCount,
  };
}

export async function addBasicPostComment(
  postId: string,
  userId: string,
  text: string
): Promise<BasicPostComment> {
  const post = await prisma.basicPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw errors.notFound("Post not found");
  }

  const comment = await prisma.basicPostComment.create({
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

  return {
    ...comment,
    user: comment.user
      ? {
          ...comment.user,
          displayName: comment.user.displayName ?? undefined,
          email: comment.user.email ?? undefined,
          friendCode: comment.user.friendCode ?? undefined,
          bio: comment.user.bio ?? undefined,
          avatarUrl: comment.user.avatarUrl ?? undefined,
        }
      : undefined,
  } as BasicPostComment;
}

export async function deleteBasicPost(
  postId: string,
  userId: string
): Promise<void> {
  const post = await prisma.basicPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw errors.notFound("Post not found");
  }

  if (post.userId !== userId) {
    throw errors.forbidden("Cannot delete this post");
  }

  await prisma.basicPost.delete({
    where: { id: postId },
  });

  await prisma.feedActivity.deleteMany({
    where: { basicPostId: postId },
  });
}

