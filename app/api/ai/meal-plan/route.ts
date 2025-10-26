import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { generateMealPlan, type MealPlanRequest } from "@/lib/ai-utils";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

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
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload: MealPlanRequest = mealPlanRequestSchema.parse(body);

    // TODO: Check user credits/tokens before generating
    // TODO: Deduct credits after successful generation

    // Generate meal plan using OpenAI
    const mealPlanData = await generateMealPlan(payload);

    // Extract recipes from meal plan and store them
    const recipes = [];
    if (mealPlanData.days && Array.isArray(mealPlanData.days)) {
      for (const day of mealPlanData.days) {
        if (day.meals) {
          const mealTypes = ["breakfast", "lunch", "dinner"];
          for (const mealType of mealTypes) {
            const meal = day.meals[mealType];
            if (meal && meal.title) {
              // Check if recipe already exists
              const existingRecipe = await prisma.recipe.findFirst({
                where: {
                  userId: user.id,
                  title: meal.title,
                },
              });

              if (!existingRecipe) {
                const recipeId = uuidv4();
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
                    source: "meal-plan",
                  },
                });
                recipes.push(recipe);
              } else {
                recipes.push(existingRecipe);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      mealPlan: mealPlanData,
      recipesCreated: recipes.length,
      message: "Meal plan generated successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
