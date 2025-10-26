import { prisma } from "./prisma";
import { errors } from "./api-errors";
import type { Friendship, UserBasic } from "./types";

/**
 * Send a friend request from one user to another
 */
export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string
): Promise<Friendship> {
  // Can't friend yourself
  if (fromUserId === toUserId) {
    throw errors.badRequest("Cannot send friend request to yourself");
  }

  // Check if friendship already exists
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: fromUserId, friendId: toUserId },
        { userId: toUserId, friendId: fromUserId },
      ],
    },
  });

  if (existing) {
    if (existing.status === "blocked") {
      throw errors.forbidden("Cannot send friend request to this user");
    }
    if (existing.status === "pending") {
      throw errors.conflict("Friend request already pending");
    }
    if (existing.status === "accepted") {
      throw errors.conflict("Already friends with this user");
    }
  }

  // Create friendship
  const friendship = await prisma.friendship.create({
    data: {
      userId: fromUserId,
      friendId: toUserId,
      status: "pending",
    },
  });

  return friendship as Friendship;
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(
  friendshipId: string,
  userId: string
): Promise<Friendship> {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    throw errors.notFound("Friend request not found");
  }

  // Only the recipient can accept
  if (friendship.friendId !== userId) {
    throw errors.forbidden("Cannot accept this friend request");
  }

  if (friendship.status !== "pending") {
    throw errors.badRequest("Friend request is not pending");
  }

  // Update status
  const updated = await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: "accepted" },
  });

  return updated as Friendship;
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(
  friendshipId: string,
  userId: string
): Promise<void> {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    throw errors.notFound("Friend request not found");
  }

  // Only the recipient can decline
  if (friendship.friendId !== userId) {
    throw errors.forbidden("Cannot decline this friend request");
  }

  // Delete the friendship
  await prisma.friendship.delete({
    where: { id: friendshipId },
  });
}

/**
 * Remove a friend (either party can remove)
 */
export async function removeFriend(
  friendshipId: string,
  userId: string
): Promise<void> {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    throw errors.notFound("Friendship not found");
  }

  // Must be part of the friendship
  if (friendship.userId !== userId && friendship.friendId !== userId) {
    throw errors.forbidden("Cannot remove this friendship");
  }

  await prisma.friendship.delete({
    where: { id: friendshipId },
  });
}

/**
 * Check if two users are friends
 */
export async function areFriends(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: userId1, friendId: userId2, status: "accepted" },
        { userId: userId2, friendId: userId1, status: "accepted" },
      ],
    },
  });

  return !!friendship;
}

/**
 * Get friendship status between two users
 */
export async function getFriendshipStatus(
  userId1: string,
  userId2: string
): Promise<"none" | "pending" | "accepted" | "blocked" | "declined"> {
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: userId1, friendId: userId2 },
        { userId: userId2, friendId: userId1 },
      ],
    },
  });

  return friendship?.status || "none";
}

/**
 * Get list of friends with optional status filter
 */
export async function getFriendsList(
  userId: string,
  status?: "pending" | "accepted" | "blocked"
): Promise<Array<Friendship & { friend: UserBasic }>> {
  const where = status ? { status } : {};

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userId }, { friendId: userId }],
      ...where,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Fetch friend details for each friendship
  const results = await Promise.all(
    friendships.map(async (friendship) => {
      const friendId =
        friendship.userId === userId ? friendship.friendId : friendship.userId;

      const friend = await prisma.user.findUnique({
        where: { id: friendId },
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          friendCode: true,
          bio: true,
        },
      });

      return {
        ...friendship,
        friend: friend as UserBasic,
      } as Friendship & { friend: UserBasic };
    })
  );

  return results;
}

/**
 * Search for users by email or display name
 */
export async function searchUsers(
  query: string,
  currentUserId: string
): Promise<UserBasic[]> {
  const users = await prisma.user.findMany({
    where: {
      AND: [
        {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { displayName: { contains: query, mode: "insensitive" } },
          ],
        },
        { id: { not: currentUserId } }, // Exclude self
        { isGuest: false }, // Only registered users
      ],
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      friendCode: true,
      bio: true,
    },
    take: 20,
  });

  return users as UserBasic[];
}

/**
 * Find user by friend code
 */
export async function findUserByFriendCode(
  friendCode: string
): Promise<UserBasic | null> {
  // Normalize the input (remove dashes, spaces, convert to uppercase)
  const normalizedCode = friendCode.replace(/[-\s]/g, "").toUpperCase();

  const user = await prisma.user.findUnique({
    where: { friendCode: normalizedCode },
    select: {
      id: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      friendCode: true,
      bio: true,
    },
  });

  return user as UserBasic | null;
}

/**
 * Get list of friend IDs for a user (accepted friends only)
 */
export async function getFriendIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userId }, { friendId: userId }],
      status: "accepted",
    },
    select: {
      userId: true,
      friendId: true,
    },
  });

  return friendships.map((f) => (f.userId === userId ? f.friendId : f.userId));
}
