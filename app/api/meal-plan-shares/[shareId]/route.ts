import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { updateMealPlanShareStatus } from "@/lib/meal-plan-utils";

const updateShareStatusSchema = z.object({
  status: z.enum(["viewed", "saved", "declined"]),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { shareId } = await params;
    const body = await request.json();
    const data = updateShareStatusSchema.parse(body);

    console.log("🔗 Update Meal Plan Share Status - Share ID:", shareId);
    console.log("🔗 Update Meal Plan Share Status - New Status:", data.status);

    const share = await updateMealPlanShareStatus(
      shareId,
      user.id,
      data.status
    );

    console.log("✅ Meal plan share status updated successfully");

    return NextResponse.json({ share });
  } catch (error) {
    console.error("❌ Update Meal Plan Share Status Error:", error);
    return handleApiError(error);
  }
}
