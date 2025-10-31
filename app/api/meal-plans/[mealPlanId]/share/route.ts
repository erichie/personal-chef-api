import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { shareMealPlanToFriend } from "@/lib/meal-plan-utils";

const shareMealPlanSchema = z.object({
  recipientId: z.string(),
  message: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mealPlanId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { mealPlanId } = await params;
    const body = await request.json();
    const data = shareMealPlanSchema.parse(body);

    console.log("🔗 Share Meal Plan - Meal Plan ID:", mealPlanId);
    console.log("🔗 Share Meal Plan - Sender ID:", user.id);
    console.log("🔗 Share Meal Plan - Recipient ID:", data.recipientId);

    const share = await shareMealPlanToFriend({
      mealPlanId,
      senderId: user.id,
      recipientId: data.recipientId,
      message: data.message,
    });

    console.log("✅ Meal plan shared successfully:", share.id);

    return NextResponse.json({ share });
  } catch (error) {
    console.error("❌ Share Meal Plan Error:", error);
    return handleApiError(error);
  }
}
