import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { removeFriend } from "@/lib/friend-utils";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ friendshipId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { friendshipId } = await params;

    await removeFriend(friendshipId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
