import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/me
 * Returns the current authenticated user's data
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    // Fetch full user data including profile
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        friendCode: true,
        bio: true,
        avatarUrl: true,
        isAnonymous: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            chefIntake: true,
            syncVersion: true,
            lastSyncedAt: true,
          },
        },
      },
    });

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: userData.id,
        email: userData.email,
        displayName: userData.displayName,
        friendCode: userData.friendCode,
        bio: userData.bio,
        avatarUrl: userData.avatarUrl,
        isAnonymous: userData.isAnonymous,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        hasCompletedIntake: !!userData.profile?.chefIntake,
        lastSyncedAt: userData.profile?.lastSyncedAt,
        syncVersion: userData.profile?.syncVersion ?? 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/me
 * Update the current user's profile information
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();

    // Only allow updating specific fields
    const allowedUpdates: {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
    } = {};

    if (body.displayName !== undefined) {
      allowedUpdates.displayName = body.displayName;
    }
    if (body.bio !== undefined) {
      allowedUpdates.bio = body.bio;
    }
    if (body.avatarUrl !== undefined) {
      allowedUpdates.avatarUrl = body.avatarUrl;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: allowedUpdates,
      select: {
        id: true,
        email: true,
        displayName: true,
        friendCode: true,
        bio: true,
        avatarUrl: true,
        isAnonymous: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    return handleApiError(error);
  }
}
