import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { toggleMealPlanPostLike } from "@/lib/meal-plan-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = await params;

    console.log("❤️ Toggle Meal Plan Post Like - Post ID:", postId);
    console.log("❤️ Toggle Meal Plan Post Like - User ID:", user.id);

    const result = await toggleMealPlanPostLike(postId, user.id);

    console.log(
      `✅ Meal plan post ${result.liked ? "liked" : "unliked"} successfully`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ Toggle Meal Plan Post Like Error:", error);
    return handleApiError(error);
  }
}
