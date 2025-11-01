import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/api-errors";
import { getRecipeVoteStatsWithUserVote } from "@/lib/recipe-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  try {
    const { recipeId } = await params;
    const auth = await getOptionalAuth(request);

    console.log("📖 Get Recipe - Recipe ID:", recipeId);
    console.log("📖 Get Recipe - User ID:", auth?.user?.id || "anonymous");

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!recipe) {
      throw errors.notFound("Recipe not found");
    }

    // Get vote statistics
    const voteStats = await getRecipeVoteStatsWithUserVote(
      recipeId,
      auth?.user?.id || null
    );

    console.log("✅ Recipe found:", recipe.title);
    console.log("✅ Vote stats:", voteStats);

    return NextResponse.json({
      recipe,
      votes: voteStats,
    });
  } catch (error) {
    console.error("❌ Get Recipe Error:", error);
    return handleApiError(error);
  }
}
