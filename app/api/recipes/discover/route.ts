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
  imageUrl: string | null;
  servings: number | null;
  totalMinutes: number | null;
  tags: unknown;
  ingredients: unknown;
  steps: unknown;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
  upvotes?: number;
  downvotes?: number;
  score?: number;
}

interface DietaryPreferences {
  dietStyle?: string;
  allergies?: string[];
  exclusions?: string[];
}

/**
 * Helper function to fetch random recipes with optional user exclusion
 */
async function fetchRandomRecipes(
  limit: number,
  excludeUserIds: string[] = []
): Promise<Recipe[]> {
  let query: string;
  let params: any[] = [];

  if (excludeUserIds.length > 0) {
    const placeholders = excludeUserIds.map((_, i) => `$${i + 1}`).join(", ");
    query = `
      SELECT 
        r.id,
        r."userId",
        r.title,
        r.description,
        r."imageUrl",
        r.servings,
        r."totalMinutes",
        r.tags,
        r.ingredients,
        r.steps,
        r.source,
        r."createdAt",
        r."updatedAt",
        COALESCE(SUM(CASE WHEN v."voteType" = 'upvote' THEN 1 ELSE 0 END), 0)::int AS upvotes,
        COALESCE(SUM(CASE WHEN v."voteType" = 'downvote' THEN 1 ELSE 0 END), 0)::int AS downvotes,
        COALESCE(
          SUM(CASE WHEN v."voteType" = 'upvote' THEN 1 ELSE 0 END) - 
          SUM(CASE WHEN v."voteType" = 'downvote' THEN 1 ELSE 0 END), 
          0
        )::int AS score
      FROM "Recipe" r
      LEFT JOIN "RecipeVote" v ON r.id = v."recipeId"
      WHERE r."userId" NOT IN (${placeholders})
      GROUP BY r.id, r."userId", r.title, r.description, r."imageUrl", r.servings, r."totalMinutes", 
               r.tags, r.ingredients, r.steps, r.source, r."createdAt", r."updatedAt"
      ORDER BY score DESC, r."createdAt" DESC
      LIMIT $${excludeUserIds.length + 1}
    `;
    params = [...excludeUserIds, limit];
  } else {
    query = `
      SELECT 
        r.id,
        r."userId",
        r.title,
        r.description,
        r."imageUrl",
        r.servings,
        r."totalMinutes",
        r.tags,
        r.ingredients,
        r.steps,
        r.source,
        r."createdAt",
        r."updatedAt",
        COALESCE(SUM(CASE WHEN v."voteType" = 'upvote' THEN 1 ELSE 0 END), 0)::int AS upvotes,
        COALESCE(SUM(CASE WHEN v."voteType" = 'downvote' THEN 1 ELSE 0 END), 0)::int AS downvotes,
        COALESCE(
          SUM(CASE WHEN v."voteType" = 'upvote' THEN 1 ELSE 0 END) - 
          SUM(CASE WHEN v."voteType" = 'downvote' THEN 1 ELSE 0 END), 
          0
        )::int AS score
      FROM "Recipe" r
      LEFT JOIN "RecipeVote" v ON r.id = v."recipeId"
      GROUP BY r.id, r."userId", r.title, r.description, r."imageUrl", r.servings, r."totalMinutes", 
               r.tags, r.ingredients, r.steps, r.source, r."createdAt", r."updatedAt"
      ORDER BY score DESC, r."createdAt" DESC
      LIMIT $1
    `;
    params = [limit];
  }

  return prisma.$queryRawUnsafe<Recipe[]>(query, ...params);
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated (includes both registered and anonymous users)
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

    console.log(
      "🔍 Recipe Discovery - User ID:",
      currentUserId || "not authenticated"
    );
    console.log("🔍 Recipe Discovery - Count:", count);

    // Fetch user preferences for both registered and anonymous users
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

    console.log("🔍 Needs dietary filtering:", needsFiltering);
    if (needsFiltering && preferences) {
      console.log("🔍 Diet style:", preferences.dietStyle);
      console.log("🔍 Allergies:", preferences.allergies);
      console.log("🔍 Exclusions:", preferences.exclusions);
    }

    let recipes: Recipe[] = [];

    // Strategy: Cascading fallback to ensure we get enough recipes
    // 1. Try other users' recipes with full dietary restrictions
    // 2. If not enough, try other users' recipes with just diet style
    // 3. If still not enough, add user's own recipes with restrictions
    // 4. If still not enough, add random unfiltered recipes

    if (needsFiltering && preferences) {
      // Step 1: Get other users' recipes with full restrictions
      console.log(
        "📍 Step 1: Fetching other users' recipes with full restrictions"
      );
      const othersRecipes = await fetchRandomRecipes(
        count * 4,
        currentUserId ? [currentUserId] : []
      );
      recipes = othersRecipes.filter((recipe) =>
        doesRecipeMeetDietaryRestrictions(recipe, preferences!)
      );
      console.log(
        `   Found ${recipes.length} recipes from others with full restrictions`
      );

      // Step 2: If not enough, try with just diet style (more lenient)
      if (recipes.length < count && preferences.dietStyle) {
        console.log(
          "📍 Step 2: Not enough recipes, trying with just diet style"
        );
        const relaxedPreferences = { dietStyle: preferences.dietStyle };
        const additionalRecipes = othersRecipes.filter((recipe) => {
          // Don't include recipes we already have
          if (recipes.find((r) => r.id === recipe.id)) return false;
          return doesRecipeMeetDietaryRestrictions(recipe, relaxedPreferences);
        });
        recipes.push(...additionalRecipes);
        console.log(
          `   Added ${additionalRecipes.length} more recipes (total: ${recipes.length})`
        );
      }

      // Step 3: If still not enough, include user's own recipes with restrictions
      if (recipes.length < count && currentUserId) {
        console.log(
          "📍 Step 3: Still not enough, including user's own recipes"
        );
        const ownRecipes = await fetchRandomRecipes(count * 2, []);
        const ownFiltered = ownRecipes
          .filter((recipe) => recipe.userId === currentUserId)
          .filter((recipe) => {
            // Don't include recipes we already have
            if (recipes.find((r) => r.id === recipe.id)) return false;
            return doesRecipeMeetDietaryRestrictions(recipe, preferences!);
          });
        recipes.push(...ownFiltered);
        console.log(
          `   Added ${ownFiltered.length} of user's own recipes (total: ${recipes.length})`
        );
      }

      // Step 4: If still not enough, add random unfiltered recipes as last resort
      if (recipes.length < count) {
        console.log("📍 Step 4: Still not enough, adding unfiltered recipes");
        const fallbackRecipes = await fetchRandomRecipes(count * 2, []);
        const additionalUnfiltered = fallbackRecipes.filter(
          (recipe) => !recipes.find((r) => r.id === recipe.id)
        );
        recipes.push(...additionalUnfiltered);
        console.log(
          `   Added ${additionalUnfiltered.length} unfiltered recipes (total: ${recipes.length})`
        );
      }
    } else {
      // No filtering needed, just get random recipes
      console.log("📍 No filtering needed, fetching random recipes");
      const excludeUserIds = currentUserId ? [currentUserId] : [];
      recipes = await fetchRandomRecipes(count, excludeUserIds);
      console.log(`   Found ${recipes.length} random recipes`);
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
