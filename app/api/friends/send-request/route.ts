import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import {
  sendFriendRequest,
  findUserByFriendCode,
  searchUsers,
} from "@/lib/friend-utils";

const sendRequestSchema = z.object({
  friendId: z.string().optional(),
  email: z.string().email().optional(),
  friendCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const { friendId, email, friendCode } = sendRequestSchema.parse(body);

    let targetUserId: string;

    if (friendId) {
      targetUserId = friendId;
    } else if (friendCode) {
      const targetUser = await findUserByFriendCode(friendCode);
      if (!targetUser) {
        return NextResponse.json(
          { error: "User not found with this friend code" },
          { status: 404 }
        );
      }
      targetUserId = targetUser.id;
    } else if (email) {
      const users = await searchUsers(email, user.id);
      const targetUser = users.find((u) => u.email === email);
      if (!targetUser) {
        return NextResponse.json(
          { error: "User not found with this email" },
          { status: 404 }
        );
      }
      targetUserId = targetUser.id;
    } else {
      return NextResponse.json(
        { error: "Must provide friendId, email, or friendCode" },
        { status: 400 }
      );
    }

    const friendship = await sendFriendRequest(user.id, targetUserId);

    return NextResponse.json({ friendship });
  } catch (error) {
    return handleApiError(error);
  }
}
