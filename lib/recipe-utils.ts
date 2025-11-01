import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/api-errors";
import { VoteType } from "@prisma/client";

export interface VoteStats {
  upvotes: number;
  downvotes: number;
  score: number;
}

export interface VoteResult extends VoteStats {
  userVote: VoteType | null;
}

/**
 * Get vote statistics for a recipe
 */
export async function getRecipeVoteStats(recipeId: string): Promise<VoteStats> {
  const votes = await prisma.recipeVote.groupBy({
    by: ["voteType"],
    where: { recipeId },
    _count: { voteType: true },
  });

  let upvotes = 0;
  let downvotes = 0;

  for (const vote of votes) {
    if (vote.voteType === "upvote") {
      upvotes = vote._count.voteType;
    } else if (vote.voteType === "downvote") {
      downvotes = vote._count.voteType;
    }
  }

  return {
    upvotes,
    downvotes,
    score: upvotes - downvotes,
  };
}

/**
 * Get vote statistics and user's current vote for a recipe
 */
export async function getRecipeVoteStatsWithUserVote(
  recipeId: string,
  userId: string | null
): Promise<VoteResult> {
  const stats = await getRecipeVoteStats(recipeId);

  let userVote: VoteType | null = null;
  if (userId) {
    const vote = await prisma.recipeVote.findUnique({
      where: {
        recipeId_userId: {
          recipeId,
          userId,
        },
      },
    });
    userVote = vote?.voteType || null;
  }

  return {
    ...stats,
    userVote,
  };
}

/**
 * Upsert a vote (create or update)
 */
export async function upsertVote(
  recipeId: string,
  userId: string,
  voteType: VoteType
): Promise<VoteResult> {
  // Check if recipe exists
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
  });

  if (!recipe) {
    throw errors.notFound("Recipe not found");
  }

  // Upsert the vote
  await prisma.recipeVote.upsert({
    where: {
      recipeId_userId: {
        recipeId,
        userId,
      },
    },
    create: {
      recipeId,
      userId,
      voteType,
    },
    update: {
      voteType,
    },
  });

  // Return updated stats
  return getRecipeVoteStatsWithUserVote(recipeId, userId);
}

/**
 * Remove a user's vote
 */
export async function removeVote(
  recipeId: string,
  userId: string
): Promise<VoteStats> {
  // Check if recipe exists
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
  });

  if (!recipe) {
    throw errors.notFound("Recipe not found");
  }

  // Delete the vote if it exists
  await prisma.recipeVote.deleteMany({
    where: {
      recipeId,
      userId,
    },
  });

  // Return updated stats
  return getRecipeVoteStats(recipeId);
}
