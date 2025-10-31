import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import {
  getMealPlanPostWithDetails,
  updateMealPlanPost,
  deleteMealPlanPost,
} from "@/lib/meal-plan-utils";

const updateMealPlanPostSchema = z.object({
  text: z.string().optional(),
  photoUrl: z.string().url().optional(),
  rating: z.number().min(1).max(5).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = await params;

    console.log("📝 Get Meal Plan Post - ID:", postId);

    const post = await getMealPlanPostWithDetails(postId, user.id);

    console.log("✅ Meal plan post retrieved successfully");

    return NextResponse.json({ post });
  } catch (error) {
    console.error("❌ Get Meal Plan Post Error:", error);
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = await params;
    const body = await request.json();
    const data = updateMealPlanPostSchema.parse(body);

    console.log("📝 Update Meal Plan Post - ID:", postId);

    const post = await updateMealPlanPost(postId, user.id, data);

    console.log("✅ Meal plan post updated successfully");

    return NextResponse.json({ post });
  } catch (error) {
    console.error("❌ Update Meal Plan Post Error:", error);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = await params;

    console.log("📝 Delete Meal Plan Post - ID:", postId);

    await deleteMealPlanPost(postId, user.id);

    console.log("✅ Meal plan post deleted successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Delete Meal Plan Post Error:", error);
    return handleApiError(error);
  }
}
