import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuth, requireAuth } from "@/lib/auth-utils";
import { handleApiError, errors } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
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

const updateRecipeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  servings: z.number().positive().optional(),
  totalMinutes: z.number().positive().optional(),
  cuisine: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ingredients: z.array(z.any()).optional(),
  steps: z.array(z.any()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { recipeId } = await params;
    const body = await request.json();
    const data = updateRecipeSchema.parse(body);

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      throw errors.notFound("Recipe not found");
    }

    if (recipe.userId !== user.id) {
      throw errors.forbidden("You do not own this recipe");
    }

    const updated = await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.servings !== undefined ? { servings: data.servings } : {}),
        ...(data.totalMinutes !== undefined
          ? { totalMinutes: data.totalMinutes }
          : {}),
        ...(data.cuisine !== undefined ? { cuisine: data.cuisine } : {}),
        ...(data.tags !== undefined ? { tags: data.tags as any } : {}),
        ...(data.ingredients !== undefined
          ? { ingredients: data.ingredients as any }
          : {}),
        ...(data.steps !== undefined ? { steps: data.steps as any } : {}),
      },
    });

    return NextResponse.json({ recipe: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
