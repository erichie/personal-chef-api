import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { updateRecipeShareStatus } from "@/lib/recipe-share-utils";

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

    console.log("🔗 Update Recipe Share Status - Share ID:", shareId);
    console.log("🔗 Update Recipe Share Status - New Status:", data.status);

    const share = await updateRecipeShareStatus(shareId, user.id, data.status);

    console.log("✅ Recipe share status updated successfully");

    return NextResponse.json({ share });
  } catch (error) {
    console.error("❌ Update Recipe Share Status Error:", error);
    return handleApiError(error);
  }
}
