import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createGuestUser, createSessionForUser } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";

const guestRequestSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId } = guestRequestSchema.parse(body);

    // Create or retrieve guest user
    const user = await createGuestUser(deviceId);

    // Create session
    const session = await createSessionForUser(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        deviceId: user.deviceId,
        isGuest: user.isGuest,
        createdAt: user.createdAt,
      },
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
