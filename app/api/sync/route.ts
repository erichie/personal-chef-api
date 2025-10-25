import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import type { SyncPayload, UserBackup } from "@/lib/types";

const syncPayloadSchema = z.object({
  chefIntake: z.any().optional(),
  inventory: z.array(z.any()).optional(),
  mealPlans: z.record(z.string(), z.any()).optional(),
  groceryList: z.array(z.any()).optional(),
  achievements: z.record(z.string(), z.any()).optional(),
  streaks: z.any().optional(),
  tokenState: z.any().optional(),
});

// POST /api/sync - Upload and merge device state with backend
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload: SyncPayload = syncPayloadSchema.parse(body);

    // Fetch or create user profile
    let profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId: user.id,
        },
      });
    }

    // Merge logic: Device data takes precedence (device is source of truth)
    const updatedProfile = await prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        chefIntake: payload.chefIntake
          ? (payload.chefIntake as any)
          : profile.chefIntake,
        inventory: payload.inventory
          ? (payload.inventory as any)
          : profile.inventory,
        mealPlans: payload.mealPlans
          ? (payload.mealPlans as any)
          : profile.mealPlans,
        groceryList: payload.groceryList
          ? (payload.groceryList as any)
          : profile.groceryList,
        achievements: payload.achievements
          ? (payload.achievements as any)
          : profile.achievements,
        streaks: payload.streaks ? (payload.streaks as any) : profile.streaks,
        tokenState: payload.tokenState
          ? (payload.tokenState as any)
          : profile.tokenState,
        lastSyncedAt: new Date(),
        syncVersion: profile.syncVersion + 1,
      },
    });

    return NextResponse.json({
      syncedAt: updatedProfile.lastSyncedAt?.toISOString(),
      version: updatedProfile.syncVersion,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/sync - Download full user backup
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    // Fetch user profile
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });

    // Fetch all user recipes
    const recipes = await prisma.recipe.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const backup: UserBackup = {
      profile: {
        chefIntake: profile?.chefIntake as any,
        inventory: profile?.inventory as any,
        mealPlans: profile?.mealPlans as any,
        groceryList: profile?.groceryList as any,
        achievements: profile?.achievements as any,
        streaks: profile?.streaks as any,
        tokenState: profile?.tokenState as any,
        lastSyncedAt: profile?.lastSyncedAt?.toISOString(),
        syncVersion: profile?.syncVersion ?? 0,
      },
      recipes: recipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description ?? undefined,
        servings: recipe.servings ?? undefined,
        totalMinutes: recipe.totalMinutes ?? undefined,
        tags: recipe.tags as any,
        ingredients: recipe.ingredients as any,
        steps: recipe.steps as any,
        source: recipe.source ?? undefined,
        createdAt: recipe.createdAt.toISOString(),
        updatedAt: recipe.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json(backup);
  } catch (error) {
    return handleApiError(error);
  }
}
