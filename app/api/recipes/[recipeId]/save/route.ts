import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError, errors } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { publishRecipe } from "@/lib/recipe-publication";

const saveSchema = z.object({
  publish: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { recipeId } = await params;
    const body = await request.json();
    const data = saveSchema.parse(body);

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      throw errors.notFound("Recipe not found");
    }

    const newRecipe = await prisma.recipe.create({
      data: {
        userId: user.id,
        title: recipe.title,
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        servings: recipe.servings,
        totalMinutes: recipe.totalMinutes,
        cuisine: recipe.cuisine,
        tags: recipe.tags,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        source: "discover-import",
        sourceUrl: recipe.sourceUrl,
      },
    });

    let publication = null;
    if (data.publish) {
      publication = await publishRecipe({
        recipeId: newRecipe.id,
        userId: user.id,
      });
    }

    return NextResponse.json({ recipe: newRecipe, publication }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

