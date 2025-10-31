import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getSharedMealPlans } from "@/lib/meal-plan-utils";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") as
      | "pending"
      | "viewed"
      | "saved"
      | "declined"
      | null;

    console.log("🔗 Get Shared Meal Plans - User ID:", user.id);
    console.log("🔗 Get Shared Meal Plans - Status Filter:", status || "all");

    const shares = await getSharedMealPlans(user.id, status || undefined);

    console.log(`✅ Retrieved ${shares.length} shared meal plans`);

    return NextResponse.json({ shares });
  } catch (error) {
    console.error("❌ Get Shared Meal Plans Error:", error);
    return handleApiError(error);
  }
}
