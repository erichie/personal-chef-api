import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getFriendsList } from "@/lib/friend-utils";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as
      | "pending"
      | "accepted"
      | "blocked"
      | undefined;

    const friendships = await getFriendsList(user.id, status);

    // Separate into accepted and pending
    const friends = friendships.filter((f) => f.status === "accepted");
    const pendingRequests = friendships.filter((f) => f.status === "pending");

    return NextResponse.json({ friends, pendingRequests });
  } catch (error) {
    return handleApiError(error);
  }
}
