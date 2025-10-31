import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import {
  createMealPlanPost,
  enrichMealPlanWithRecipes,
} from "@/lib/meal-plan-utils";

const createMealPlanPostSchema = z.object({
  mealPlanId: z.string(),
  text: z.string().optional(),
  photoUrl: z.string().url().optional(),
  rating: z.number().min(1).max(5).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const data = createMealPlanPostSchema.parse(body);

    console.log("📝 Create Meal Plan Post - User ID:", user.id);
    console.log("📝 Create Meal Plan Post - Meal Plan ID:", data.mealPlanId);

    const post = await createMealPlanPost({
      userId: user.id,
      mealPlanId: data.mealPlanId,
      text: data.text,
      photoUrl: data.photoUrl,
      rating: data.rating,
    });

    console.log("✅ Meal plan post created successfully:", post.id);

    return NextResponse.json({ post });
  } catch (error) {
    console.error("❌ Create Meal Plan Post Error:", error);
    return handleApiError(error);
  }
}
