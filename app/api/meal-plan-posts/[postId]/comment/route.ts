import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { addMealPlanPostComment } from "@/lib/meal-plan-utils";

const addCommentSchema = z.object({
  text: z.string().min(1).max(1000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = await params;
    const body = await request.json();
    const data = addCommentSchema.parse(body);

    console.log("💬 Add Meal Plan Post Comment - Post ID:", postId);
    console.log("💬 Add Meal Plan Post Comment - User ID:", user.id);

    const comment = await addMealPlanPostComment(postId, user.id, data.text);

    console.log("✅ Meal plan post comment added successfully:", comment.id);

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("❌ Add Meal Plan Post Comment Error:", error);
    return handleApiError(error);
  }
}
