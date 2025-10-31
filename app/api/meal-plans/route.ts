import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { createMealPlan } from "@/lib/meal-plan-utils";

// Template meal structure validation
const templateMealSchema = z.object({
  recipeId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  servings: z.number().optional(),
  totalMinutes: z.number().optional(),
});

const templateDayMealsSchema = z.object({
  breakfast: templateMealSchema.optional(),
  lunch: templateMealSchema.optional(),
  dinner: templateMealSchema.optional(),
});

const templateMealPlanDaySchema = z.object({
  dayNumber: z.number().min(0),
  meals: templateDayMealsSchema,
});

const createMealPlanSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  days: z.array(templateMealPlanDaySchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const data = createMealPlanSchema.parse(body);

    console.log("📅 Create Meal Plan - User ID:", user.id);
    console.log("📅 Create Meal Plan - Title:", data.title);

    // Validate that all meals have non-empty recipeIds
    for (const day of data.days) {
      for (const mealType of ["breakfast", "lunch", "dinner"] as const) {
        const meal = day.meals[mealType];
        if (meal && (!meal.recipeId || meal.recipeId.trim() === "")) {
          return NextResponse.json(
            {
              error: `Missing recipeId for ${mealType} on day ${day.dayNumber}. Recipe: "${meal.title}"`,
              code: "MISSING_RECIPE_ID",
            },
            { status: 400 }
          );
        }
      }
    }

    const mealPlan = await createMealPlan({
      userId: user.id,
      title: data.title,
      description: data.description,
      days: data.days,
    });

    console.log("✅ Meal plan created successfully:", mealPlan.id);

    return NextResponse.json({ mealPlan });
  } catch (error) {
    console.error("❌ Create Meal Plan Error:", error);
    return handleApiError(error);
  }
}
