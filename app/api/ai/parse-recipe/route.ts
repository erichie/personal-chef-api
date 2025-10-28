import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { parseRecipeFromUrl } from "@/lib/ai-utils";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { trackAiUsage, AiEndpoint } from "@/lib/ai-usage-utils";

const parseRecipeRequestSchema = z.object({
  url: z.string().url("Invalid URL format"),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const { url } = parseRecipeRequestSchema.parse(body);

    // TODO: Check user credits/tokens before generating
    // TODO: Deduct credits after successful generation

    // Parse recipe from URL using AI
    const parsedRecipeData = await parseRecipeFromUrl(url);

    // Store the parsed recipe
    const recipeId = uuidv4();
    const recipe = await prisma.recipe.create({
      data: {
        id: recipeId,
        userId: user.id,
        title: parsedRecipeData.title,
        description: parsedRecipeData.description || null,
        servings: parsedRecipeData.servings || null,
        totalMinutes: parsedRecipeData.totalMinutes || null,
        tags: parsedRecipeData.tags || null,
        ingredients: parsedRecipeData.ingredients || [],
        steps: parsedRecipeData.steps || null,
        source: "pasted",
      },
    });

    // Track usage
    await trackAiUsage(user.id, AiEndpoint.PARSE_RECIPE);

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
        sourceUrl: url,
        createdAt: recipe.createdAt,
      },
      message: "Recipe parsed successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
