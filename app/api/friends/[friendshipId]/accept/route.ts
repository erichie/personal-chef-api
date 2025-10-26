import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { acceptFriendRequest } from "@/lib/friend-utils";
import { createFriendshipActivity } from "@/lib/feed-utils";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { friendshipId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { friendshipId } = params;

    const friendship = await acceptFriendRequest(friendshipId, user.id);

    // Get friend details for activity
    const friend = await prisma.user.findUnique({
      where: { id: friendship.userId },
      select: { displayName: true, email: true },
    });

    // Create friendship activity (private to current user)
    await createFriendshipActivity(
      user.id,
      friendship.userId,
      friend?.displayName || friend?.email
    );

    return NextResponse.json({ friendship });
  } catch (error) {
    return handleApiError(error);
  }
}
