import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, errors } from "@/lib/api-errors";
import { generateFriendCode } from "@/lib/friend-code-generator";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

const signUpSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
  deviceId: z.string().min(1, "Device ID is required"),
  callbackURL: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, deviceId } = signUpSchema.parse(body);

    // Check if a guest user exists with this deviceId
    const existingGuest = await prisma.user.findUnique({
      where: { deviceId },
    });

    if (existingGuest && existingGuest.isGuest) {
      // Convert existing guest to registered user

      // Check if email is already taken by another user
      const existingEmailUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingEmailUser && existingEmailUser.id !== existingGuest.id) {
        throw errors.conflict("Email is already registered");
      }

      // Let better-auth create the new user with proper password hashing
      // Use a temporary deviceId since we'll migrate data from guest
      const tempDeviceId = `temp-${crypto.randomUUID()}`;
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: name || email.split("@")[0],
          deviceId: tempDeviceId,
        },
      });

      // Now migrate all data from guest user to the new registered user
      if (signUpResult.user) {
        const newUserId = signUpResult.user.id;

        // Get guest user's profile
        const guestProfile = await prisma.userProfile.findUnique({
          where: { userId: existingGuest.id },
        });

        // Get new user's profile (created by better-auth)
        let newProfile = await prisma.userProfile.findUnique({
          where: { userId: newUserId },
        });

        // Create profile if it doesn't exist
        if (!newProfile) {
          newProfile = await prisma.userProfile.create({
            data: { userId: newUserId },
          });
        }

        // Migrate profile data from guest to new user
        if (guestProfile) {
          await prisma.userProfile.update({
            where: { userId: newUserId },
            data: {
              chefIntake: guestProfile.chefIntake as Prisma.InputJsonValue,
              inventory: guestProfile.inventory as Prisma.InputJsonValue,
              mealPlans: guestProfile.mealPlans as Prisma.InputJsonValue,
              groceryList: guestProfile.groceryList as Prisma.InputJsonValue,
              achievements: guestProfile.achievements as Prisma.InputJsonValue,
              streaks: guestProfile.streaks as Prisma.InputJsonValue,
              tokenState: guestProfile.tokenState as Prisma.InputJsonValue,
              lastSyncedAt: guestProfile.lastSyncedAt,
              syncVersion: guestProfile.syncVersion,
            },
          });
        }

        // Migrate recipes from guest to new user
        await prisma.recipe.updateMany({
          where: { userId: existingGuest.id },
          data: { userId: newUserId },
        });

        // Migrate posts from guest to new user
        await prisma.recipePost.updateMany({
          where: { userId: existingGuest.id },
          data: { userId: newUserId },
        });

        // Migrate friendships
        await prisma.friendship.updateMany({
          where: { userId: existingGuest.id },
          data: { userId: newUserId },
        });

        await prisma.friendship.updateMany({
          where: { friendId: existingGuest.id },
          data: { friendId: newUserId },
        });

        // Store guest's friendCode and deviceId for later
        const guestFriendCode = existingGuest.friendCode;
        const guestDeviceId = existingGuest.deviceId;

        // Delete guest profile
        if (guestProfile) {
          await prisma.userProfile.delete({
            where: { userId: existingGuest.id },
          });
        }

        // Delete guest sessions
        await prisma.session.deleteMany({
          where: { userId: existingGuest.id },
        });

        // Delete guest user (this frees up the deviceId)
        await prisma.user.delete({
          where: { id: existingGuest.id },
        });

        // NOW update the new user with friendCode and original deviceId
        await prisma.user.update({
          where: { id: newUserId },
          data: {
            friendCode: guestFriendCode,
            deviceId: guestDeviceId,
          },
        });

        // Create a fresh session by signing in with the new credentials
        // This ensures the session is valid for the migrated user
        const signInResult = await auth.api.signInEmail({
          body: {
            email,
            password,
          },
        });

        return NextResponse.json({
          ...signInResult,
          converted: true,
        });
      }

      // If we get here, something went wrong with the conversion
      // Return the original sign-up result
      return NextResponse.json({
        ...signUpResult,
        converted: true,
      });
    } else if (existingGuest && !existingGuest.isGuest) {
      // Device ID already registered to a non-guest user
      throw errors.conflict("Device ID already registered to an account");
    } else {
      // No guest exists - let better-auth handle the full sign-up
      // But we need to ensure deviceId is set

      // Check if email is already taken
      const existingEmailUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingEmailUser) {
        throw errors.conflict("Email is already registered");
      }

      // Generate friend code
      let friendCode: string | null = null;
      const maxAttempts = 10;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const code = generateFriendCode();
        const existing = await prisma.user.findUnique({
          where: { friendCode: code },
        });

        if (!existing) {
          friendCode = code;
          break;
        }
      }

      // Let better-auth handle sign-up
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: name || email.split("@")[0],
          deviceId,
        },
      });

      // Update user with friendCode
      if (signUpResult.user) {
        await prisma.user.update({
          where: { id: signUpResult.user.id },
          data: { friendCode },
        });
      }

      return NextResponse.json(signUpResult);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
