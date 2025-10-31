import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { deleteMealPlanPostComment } from "@/lib/meal-plan-utils";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { commentId } = await params;

    console.log("💬 Delete Meal Plan Post Comment - Comment ID:", commentId);
    console.log("💬 Delete Meal Plan Post Comment - User ID:", user.id);

    await deleteMealPlanPostComment(commentId, user.id);

    console.log("✅ Meal plan post comment deleted successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Delete Meal Plan Post Comment Error:", error);
    return handleApiError(error);
  }
}
