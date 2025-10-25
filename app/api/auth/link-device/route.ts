import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest, migrateGuestData } from "@/lib/auth-utils";
import { handleApiError, errors } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

const linkDeviceSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
});

export async function POST(request: NextRequest) {
  try {
    // Require authenticated user (not guest)
    const authenticatedUser = await getUserFromRequest(request);

    if (authenticatedUser.isGuest) {
      throw errors.forbidden("Guest users cannot link devices");
    }

    const body = await request.json();
    const { deviceId } = linkDeviceSchema.parse(body);

    // Find guest user by deviceId
    const guestUser = await prisma.user.findUnique({
      where: { deviceId },
    });

    if (!guestUser) {
      throw errors.notFound("Guest user not found with this device ID");
    }

    if (!guestUser.isGuest) {
      throw errors.badRequest("This device is already linked to an account");
    }

    // Migrate guest data to authenticated user
    await migrateGuestData(guestUser.id, authenticatedUser.id);

    return NextResponse.json({
      success: true,
      message: "Device linked successfully",
      userId: authenticatedUser.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
