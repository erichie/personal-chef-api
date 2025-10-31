import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { shareRecipeToFriend } from "@/lib/recipe-share-utils";

const shareRecipeSchema = z.object({
  recipientId: z.string(),
  message: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { recipeId } = await params;
    const body = await request.json();
    const data = shareRecipeSchema.parse(body);

    console.log("🔗 Share Recipe - Recipe ID:", recipeId);
    console.log("🔗 Share Recipe - Sender ID:", user.id);
    console.log("🔗 Share Recipe - Recipient ID:", data.recipientId);

    const share = await shareRecipeToFriend({
      recipeId,
      senderId: user.id,
      recipientId: data.recipientId,
      message: data.message,
    });

    console.log("✅ Recipe shared successfully:", share.id);

    return NextResponse.json({ share });
  } catch (error) {
    console.error("❌ Share Recipe Error:", error);
    return handleApiError(error);
  }
}
