import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { parseRecipeFromUrl } from "@/lib/ai-utils";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import {
  trackAiUsage,
  AiEndpoint,
  checkParseRecipeLimit,
  validateUserTokens,
  MEAL_PLAN_TOKEN_COST,
} from "@/lib/ai-usage-utils";

const parseRecipeRequestSchema = z.object({
  url: z.string().url("Invalid URL format"),
  tokensToUse: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload = parseRecipeRequestSchema.parse(body);
    const { url } = payload;

    let usedTokens = false;

    // If tokens are provided, validate them instead of checking limit
    if (payload.tokensToUse !== undefined) {
      if (payload.tokensToUse !== MEAL_PLAN_TOKEN_COST) {
        return NextResponse.json(
          {
            error: "Invalid token amount",
            code: "INVALID_TOKEN_AMOUNT",
            details: {
              required: MEAL_PLAN_TOKEN_COST,
              provided: payload.tokensToUse,
            },
          },
          { status: 400 }
        );
      }

      const tokenValidation = await validateUserTokens(
        user.id,
        MEAL_PLAN_TOKEN_COST
      );

      if (!tokenValidation.valid) {
        return NextResponse.json(
          {
            error: tokenValidation.error || "Insufficient tokens",
            code: "INSUFFICIENT_TOKENS",
            details: {
              required: MEAL_PLAN_TOKEN_COST,
              currentBalance: tokenValidation.currentBalance,
            },
          },
          { status: 402 }
        );
      }

      usedTokens = true;
    } else {
      // No tokens provided - check normal limit
      const limitCheck = await checkParseRecipeLimit(user.id);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: "Recipe parsing limit reached",
            code: "LIMIT_EXCEEDED",
            details: {
              limit: limitCheck.limit,
              used: limitCheck.used,
              remaining: limitCheck.remaining,
              resetsAt: limitCheck.resetsAt,
              isLifetime: limitCheck.resetsAt === null,
              tokenCost: MEAL_PLAN_TOKEN_COST,
            },
          },
          { status: 429 }
        );
      }
    }

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
      usedTokens,
      tokensUsed: usedTokens ? MEAL_PLAN_TOKEN_COST : 0,
      message: usedTokens
        ? "Recipe parsed successfully using tokens"
        : "Recipe parsed successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
