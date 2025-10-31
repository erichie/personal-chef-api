import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import {
  doesRecipeMeetDietaryRestrictions,
  hasDietaryRestrictions,
} from "@/lib/recipe-search-utils";

interface Recipe {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  servings: number | null;
  totalMinutes: number | null;
  tags: unknown;
  ingredients: unknown;
  steps: unknown;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DietaryPreferences {
  dietStyle?: string;
  allergies?: string[];
  exclusions?: string[];
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated (optional)
    const auth = await getOptionalAuth(request);
    const currentUserId = auth?.user?.id;

    // Get count parameter from query string, default to 5, max 50
    const { searchParams } = new URL(request.url);
    const countParam = searchParams.get("count");
    let count = 5; // default

    if (countParam) {
      const parsedCount = parseInt(countParam, 10);
      if (!isNaN(parsedCount) && parsedCount > 0) {
        count = Math.min(parsedCount, 50); // cap at 50
      }
    }

    console.log("🔍 Recipe Discovery - User ID:", currentUserId || "anonymous");
    console.log("🔍 Recipe Discovery - Count:", count);

    // Fetch user preferences if authenticated
    let preferences: DietaryPreferences | null = null;
    if (currentUserId) {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: currentUserId },
        select: { chefIntake: true },
      });

      if (profile?.chefIntake) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chefIntake = profile.chefIntake as any;
        preferences = {
          dietStyle: chefIntake?.dietStyle,
          allergies: chefIntake?.allergies,
          exclusions: chefIntake?.exclusions,
        };
      }
    }

    // Determine if we need to filter based on preferences
    const needsFiltering = preferences && hasDietaryRestrictions(preferences);

    // Get more recipes if we need to filter (to account for filtered out recipes)
    const fetchCount = needsFiltering ? count * 4 : count;

    console.log("🔍 Needs dietary filtering:", needsFiltering);
    if (needsFiltering && preferences) {
      console.log("🔍 Diet style:", preferences.dietStyle);
      console.log("🔍 Allergies:", preferences.allergies);
      console.log("🔍 Exclusions:", preferences.exclusions);
    }

    // Build query to get random recipes
    // If authenticated, exclude the current user's recipes
    let query: string;
    let params: any[] = [];

    if (currentUserId) {
      query = `
        SELECT 
          id,
          "userId",
          title,
          description,
          servings,
          "totalMinutes",
          tags,
          ingredients,
          steps,
          source,
          "createdAt",
          "updatedAt"
        FROM "Recipe"
        WHERE "userId" != $1
        ORDER BY RANDOM()
        LIMIT $2
      `;
      params = [currentUserId, fetchCount];
    } else {
      query = `
        SELECT 
          id,
          "userId",
          title,
          description,
          servings,
          "totalMinutes",
          tags,
          ingredients,
          steps,
          source,
          "createdAt",
          "updatedAt"
        FROM "Recipe"
        ORDER BY RANDOM()
        LIMIT $1
      `;
      params = [fetchCount];
    }

    let recipes = await prisma.$queryRawUnsafe<Recipe[]>(query, ...params);

    console.log(`📥 Fetched ${recipes.length} random recipes`);

    // Apply dietary filtering if needed
    if (needsFiltering && preferences) {
      const beforeCount = recipes.length;
      recipes = recipes.filter((recipe) =>
        doesRecipeMeetDietaryRestrictions(recipe, preferences!)
      );
      console.log(
        `🔍 Filtered from ${beforeCount} to ${recipes.length} recipes based on dietary preferences`
      );
    }

    // Return only the requested count
    const finalRecipes = recipes.slice(0, count);

    console.log(`✅ Returning ${finalRecipes.length} recipes for discovery`);

    return NextResponse.json({ recipes: finalRecipes });
  } catch (error) {
    console.error("❌ Recipe Discovery Error:", error);
    return handleApiError(error);
  }
}
