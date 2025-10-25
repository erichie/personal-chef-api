import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import {
  generateReplaceRecipe,
  type ReplaceRecipeRequest,
} from "@/lib/ai-utils";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

const replaceRecipeRequestSchema = z.object({
  originalRecipe: z.object({
    title: z.string(),
    ingredients: z.array(z.any()).optional(),
    totalMinutes: z.number().optional(),
  }),
  replacementReason: z.string(),
  preferences: z.any().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload: ReplaceRecipeRequest =
      replaceRecipeRequestSchema.parse(body);

    // TODO: Check user credits/tokens before generating
    // TODO: Deduct credits after successful generation

    // Generate replacement recipe using OpenAI
    const replacementRecipeData = await generateReplaceRecipe(payload);

    // Store the replacement recipe
    const recipeId = uuidv4();
    const recipe = await prisma.recipe.create({
      data: {
        id: recipeId,
        userId: user.id,
        title: replacementRecipeData.title,
        description: replacementRecipeData.description || null,
        servings: replacementRecipeData.servings || null,
        totalMinutes: replacementRecipeData.totalMinutes || null,
        tags: replacementRecipeData.tags || null,
        ingredients: replacementRecipeData.ingredients || [],
        steps: replacementRecipeData.steps || null,
        source: "generated",
      },
    });

    return NextResponse.json({
      recipe: {
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        totalMinutes: recipe.totalMinutes,
        tags: recipe.tags,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        source: recipe.source,
        createdAt: recipe.createdAt,
      },
      message: "Replacement recipe generated successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
