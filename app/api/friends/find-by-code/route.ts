import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { findUserByFriendCode } from "@/lib/friend-utils";

const findByCodeSchema = z.object({
  friendCode: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request); // Must be authenticated
    const body = await request.json();
    const { friendCode } = findByCodeSchema.parse(body);

    const user = await findUserByFriendCode(friendCode);

    if (!user) {
      return NextResponse.json(
        { error: "User not found with this friend code" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
