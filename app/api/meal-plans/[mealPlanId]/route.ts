import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getMealPlan, enrichMealPlanWithRecipes } from "@/lib/meal-plan-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mealPlanId: string }> }
) {
  try {
    await requireAuth(request);
    const { mealPlanId } = await params;

    console.log("📅 Get Meal Plan - ID:", mealPlanId);

    const mealPlan = await getMealPlan(mealPlanId);
    console.log("📅 Meal Plan Days:", JSON.stringify(mealPlan.days, null, 2));

    const enrichedMealPlan = await enrichMealPlanWithRecipes(mealPlan);
    console.log(
      "📅 Enriched Recipes Count:",
      enrichedMealPlan.recipes?.length || 0
    );
    console.log("✅ Meal plan retrieved successfully");

    return NextResponse.json({ mealPlan: enrichedMealPlan });
  } catch (error) {
    console.error("❌ Get Meal Plan Error:", error);
    return handleApiError(error);
  }
}
