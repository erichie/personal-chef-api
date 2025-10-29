import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { generateHybridMealPlan, type MealPlanRequest } from "@/lib/ai-utils";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { generateRecipeEmbedding } from "@/lib/embedding-utils";
import { recordRecipeUsage } from "@/lib/recipe-search-utils";
import {
  checkMealPlanLimit,
  trackAiUsage,
  AiEndpoint,
  validateUserTokens,
  MEAL_PLAN_TOKEN_COST,
} from "@/lib/ai-usage-utils";

/**
 * Sanitize meal plan data to convert null values to undefined
 * This prevents validation errors on the frontend
 */
function sanitizeMealPlan(mealPlan: any): any {
  if (!mealPlan || typeof mealPlan !== "object") return mealPlan;

  // Deep clone to avoid mutating original
  const sanitized = JSON.parse(
    JSON.stringify(mealPlan, (key, value) => {
      // Convert null to undefined (undefined values will be omitted in JSON)
      return value === null ? undefined : value;
    })
  );

  return sanitized;
}

const mealPlanRequestSchema = z.object({
  numRecipes: z.number().optional(),
  preferences: z.object({
    startDate: z.string(),
    endDate: z.string(),
    householdSize: z.number().optional(),
    dietStyle: z.string().optional(),
    allergies: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional(),
    maxDinnerMinutes: z.number().optional(),
    cookingSkillLevel: z.string().optional(),
    cuisinePreferences: z
      .array(
        z.object({
          cuisine: z.string(),
          level: z.enum(["LOVE", "LIKE", "NEUTRAL", "DISLIKE", "AVOID"]),
        })
      )
      .optional(),
  }),
  inventoryItems: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().optional(),
        unit: z.string().optional(),
      })
    )
    .optional(),
  preferencesExplanation: z.string().optional(),
  tokensToUse: z.number().optional(), // Optional: tokens to use to bypass limit
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload = mealPlanRequestSchema.parse(body);

    let usedTokens = false;

    // If tokens are provided, validate them instead of checking limit
    if (payload.tokensToUse !== undefined) {
      // Validate token amount is correct
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

      // Validate user has enough tokens
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
          { status: 402 } // Payment Required
        );
      }

      usedTokens = true;
      console.log(
        `User ${user.id} using ${MEAL_PLAN_TOKEN_COST} tokens for meal plan`
      );
    } else {
      // No tokens provided - check normal limit
      const limitCheck = await checkMealPlanLimit(user.id);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: "Meal plan generation limit reached",
            code: "LIMIT_EXCEEDED",
            details: {
              limit: limitCheck.limit,
              used: limitCheck.used,
              remaining: limitCheck.remaining,
              resetsAt: limitCheck.resetsAt,
              isLifetime: limitCheck.resetsAt === null,
              tokenCost: MEAL_PLAN_TOKEN_COST, // Inform user about token option
            },
          },
          { status: 429 }
        );
      }
    }

    // Generate meal plan using hybrid approach (database + AI)
    const hybridResult = await generateHybridMealPlan(payload, user.id);
    const mealPlanData = hybridResult.mealPlan;

    // Extract recipes from meal plan and store them
    const recipes = [];
    const recipeIdMap = new Map<string, string>(); // Map meal title to recipe ID
    const recipeIdsUsed: string[] = [];

    if (mealPlanData.days && Array.isArray(mealPlanData.days)) {
      for (const day of mealPlanData.days) {
        if (day.meals) {
          const mealTypes = ["breakfast", "lunch", "dinner"];
          for (const mealType of mealTypes) {
            const meal = day.meals[mealType];
            if (meal && meal.title) {
              let recipeId: string;

              // Check if this is an existing recipe (has an id from database)
              if (
                meal.id &&
                typeof meal.id === "string" &&
                meal.id.length === 36
              ) {
                // This is a recipe from the database
                recipeId = meal.id;
                recipeIdsUsed.push(recipeId);

                const existingRecipe = await prisma.recipe.findUnique({
                  where: { id: recipeId },
                });
                if (existingRecipe) {
                  recipes.push(existingRecipe);
                }
              } else {
                // This is a new AI-generated recipe - store it
                const existingRecipe = await prisma.recipe.findFirst({
                  where: {
                    userId: user.id,
                    title: meal.title,
                  },
                });

                if (!existingRecipe) {
                  recipeId = uuidv4();

                  // Generate embedding for the new recipe
                  let embedding: number[] | null = null;
                  try {
                    embedding = await generateRecipeEmbedding({
                      title: meal.title,
                      description: meal.description,
                      tags: meal.tags,
                      ingredients: meal.ingredients,
                    });
                  } catch (error) {
                    console.error("Failed to generate embedding:", error);
                    // Continue without embedding
                  }

                  // Create recipe without embedding first
                  const recipe = await prisma.recipe.create({
                    data: {
                      id: recipeId,
                      userId: user.id,
                      title: meal.title,
                      description: meal.description || null,
                      servings: meal.servings || null,
                      totalMinutes: meal.totalMinutes || null,
                      tags: meal.tags || null,
                      ingredients: meal.ingredients || [],
                      steps: meal.steps || null,
                      source: "ai",
                      embeddingVersion: embedding ? 1 : null,
                    },
                  });

                  // Update with embedding using raw SQL if we have one
                  if (embedding) {
                    await prisma.$executeRawUnsafe(
                      `UPDATE "Recipe" SET embedding = $1::vector WHERE id = $2`,
                      `[${embedding.join(",")}]`,
                      recipeId
                    );
                  }

                  recipes.push(recipe);
                  recipeIdsUsed.push(recipeId);
                } else {
                  recipeId = existingRecipe.id;
                  recipes.push(existingRecipe);
                  recipeIdsUsed.push(recipeId);
                }
              }

              // Store the mapping and inject recipeId into the meal
              recipeIdMap.set(meal.title, recipeId);
              meal.recipeId = recipeId;
            }
          }
        }
      }
    }

    // Record recipe usage for tracking
    await recordRecipeUsage(user.id, recipeIdsUsed);

    // Track AI endpoint usage
    await trackAiUsage(user.id, AiEndpoint.MEAL_PLAN);

    // Sanitize meal plan data to remove null values (convert to undefined)
    const sanitizedMealPlan = sanitizeMealPlan(mealPlanData);

    return NextResponse.json({
      mealPlan: sanitizedMealPlan,
      recipesCreated: recipes.length,
      recipesFromDatabase: hybridResult.recipesFromDatabase,
      recipesGenerated: hybridResult.recipesGenerated,
      costSavingsEstimate: hybridResult.costSavingsEstimate,
      recipes: recipes.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        servings: r.servings,
        totalMinutes: r.totalMinutes,
      })),
      usedTokens, // Indicates if tokens were used (mobile app should deduct)
      tokensUsed: usedTokens ? MEAL_PLAN_TOKEN_COST : 0, // Amount to deduct
      message: usedTokens
        ? "Meal plan generated successfully using tokens"
        : "Meal plan generated successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
