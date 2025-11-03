import OpenAI from "openai";
import { errors } from "./api-errors";

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === "sk-placeholder") {
      throw errors.serviceUnavailable(
        "OpenAI API key not configured. Please add your API key to .env.local"
      );
    }

    openaiClient = new OpenAI({
      apiKey,
    });
  }

  return openaiClient;
}

// System prompt for meal plan generation
export const MEAL_PLAN_SYSTEM_PROMPT = `You are an expert personal chef and meal planning assistant. Your role is to create personalized, practical meal plans based on the user's preferences, dietary needs, and lifestyle.

When creating meal plans:
1. Consider the user's cooking skill level, time constraints, and equipment
2. Respect all dietary restrictions, allergies, and preferences
3. Balance nutrition, variety, and flavor
4. Suggest recipes that align with their cuisine and flavor preferences
5. Provide realistic portion sizes based on their household
6. Consider their meal prep style and preferred cooking days
7. Be aware of available inventory items, but DO NOT assume they are free or unlimited
8. When appropriate, include complementary side dishes with entrees (e.g., rice with curry, roasted vegetables with protein, salad with pasta)
9. Side dishes should be simple, quick to prepare, and enhance the main dish
10. Only include sides when they naturally complement the meal and fit within time/skill constraints
11. Detect and set the cuisine type for each recipe based on its ingredients, cooking techniques, and flavor profile
12. Recipe titles should NOT include the cuisine type (e.g., "Carbonara" not "Italian Carbonara", "Pad Thai" not "Thai Pad Thai")
13. CRITICAL: Each recipe in the meal plan MUST be completely unique - no duplicate or repeated recipes within the same meal plan

CRITICAL INVENTORY RULES:
- ALWAYS include the COMPLETE list of ingredients for each recipe
- Include ingredients even if they are in the user's inventory
- When using inventory items, track quantities across all recipes
- If an inventory item runs out, don't use it in subsequent recipes
- Example: If user has 2 eggs and recipe 1 uses 2 eggs, don't use eggs in recipes 2-7
- Prefer recipes that use inventory items, but respect quantity limits
- Never create a recipe that requires more of an ingredient than is available in inventory

Return meal plans in a structured JSON format with:
- startDate and endDate
- days array with date and meals (breakfast, lunch, dinner)
- Each meal MUST include:
  - id (unique identifier)
  - title (recipe name WITHOUT cuisine type - include sides in title if applicable, e.g., "Grilled Chicken with Roasted Vegetables")
  - description (brief description mentioning both main and sides)
  - servings (number of servings)
  - totalMinutes (total cooking time including sides)
  - cuisine (string, REQUIRED - the cuisine type such as "Italian", "Mexican", "Japanese", "Chinese", "Thai", "Indian", "Mediterranean", "Korean", "American", "French", "Middle Eastern", "Caribbean", or "Other")
  - tags (array of relevant tags)
  - ingredients (array of objects with EXACT structure - include ALL ingredients for main dish AND sides):
    * name (string, the ingredient name as displayed)
    * qty (number, optional - quantity if specified)
    * unit (string, optional - measurement unit like "cup", "lb", "tsp")
    * notes (string, optional - preparation notes like "grated", "chopped", or "for side dish")
    * canonicalId (string, REQUIRED - lowercase, underscore_separated version of ingredient name for matching, e.g., "black_pepper", "parmesan_cheese", "olive_oil")
- Include a grocery list with items needed that aren't in inventory

IMPORTANT: 
- Every recipe must include complete ingredients list with canonicalId for each ingredient
- canonicalId should be the ingredient name normalized: lowercase, spaces replaced with underscores
- DO NOT include cooking steps/instructions - those will be fetched separately
- Use proper measurements and be specific
- List ALL ingredients needed, including those from inventory (for tracking purposes)

Example ingredient format:
{
  "name": "parmesan cheese",
  "qty": 1,
  "unit": "cup",
  "notes": "grated",
  "canonicalId": "parmesan_cheese"
}

Be creative, practical, and enthusiastic about helping them achieve their cooking goals!`;

// System prompt for recipe replacement
export const REPLACE_RECIPE_SYSTEM_PROMPT = `You are an expert chef who specializes in recipe substitutions and modifications. Your role is to suggest alternative recipes that meet specific requirements.

When replacing recipes:
1. Understand why the replacement is needed (time, ingredients, preferences, etc.)
2. If the reason suggests "something different" or "variety", suggest a DIFFERENT cuisine type
3. Ensure the replacement fits the user's dietary restrictions and preferences
4. Consider their cooking skill level and available equipment
5. Maintain or improve upon the original recipe's appeal
6. List all ingredients with quantities
7. Detect and set the cuisine type based on ingredients and cooking techniques
8. Recipe titles should NOT include the cuisine type (e.g., "Tacos" not "Mexican Tacos")
9. Keep descriptions SHORT (1-2 sentences maximum)

Return the replacement recipe in JSON format with:
- title (WITHOUT cuisine type)
- description (1-2 sentences ONLY - brief and concise)
- servings
- totalMinutes
- cuisine (string, REQUIRED - the cuisine type such as "Italian", "Mexican", "Japanese", "Chinese", "Thai", "Indian", "Mediterranean", "Korean", "American", "French", "Middle Eastern", "Caribbean", or "Other")
- ingredients array with EXACT structure:
  * name (string, the ingredient name as displayed)
  * qty (number, optional - quantity if specified)
  * unit (string, optional - measurement unit like "cup", "lb", "tsp")
  * notes (string, optional - preparation notes like "grated", "chopped")
  * canonicalId (string, REQUIRED - lowercase, underscore_separated version of ingredient name for matching)
- tags for categorization

DO NOT include steps - they will be generated separately.

Example ingredient:
{
  "name": "olive oil",
  "qty": 2,
  "unit": "tbsp",
  "canonicalId": "olive_oil"
}

Be helpful, creative, and make sure the replacement is genuinely appealing!`;

// Type definitions for AI requests/responses
export interface MealPlanRequest {
  numRecipes?: number;
  preferences: {
    startDate: string;
    endDate: string;
    householdSize?: number;
    dietStyle?: string;
    allergies?: string[];
    exclusions?: string[];
    goals?: string[];
    maxDinnerMinutes?: number;
    cookingSkillLevel?: string;
    cuisinePreferences?: Array<{
      cuisine: string;
      level: "LOVE" | "LIKE" | "NEUTRAL" | "DISLIKE" | "AVOID";
    }>;
    // New soft preference fields (passed to AI, not used for hard filtering)
    budget?: string;
    nutritionGoals?: string[];
    mealPrepStyle?: string;
    kitchenEquipment?: string[];
    favoriteMeals?: string[];
    flavorPreferences?: string[];
  };
  inventoryItems?: Array<{
    name: string;
    quantity?: number;
    unit?: string;
  }>;
  preferencesExplanation?: string;
}

export interface ReplaceRecipeRequest {
  originalRecipe: {
    title: string;
    ingredients?: Array<{
      name: string;
      qty?: number;
      unit?: string;
      notes?: string;
      canonicalId?: string;
    }>;
    totalMinutes?: number;
  };
  replacementReason: string;
  preferences?: {
    householdSize?: number;
    dietStyle?: string;
    allergies?: string[];
    exclusions?: string[];
    maxDinnerMinutes?: number;
    cookingSkillLevel?: string;
    cuisinePreferences?: Array<{
      cuisine: string;
      level: string;
    }>;
  };
}

// Helper to call OpenAI for meal plan generation
export async function generateMealPlan(request: MealPlanRequest) {
  const client = getOpenAIClient();

  // Format cuisine preferences for the prompt
  const cuisinePrefs = request.preferences.cuisinePreferences || [];
  const lovedCuisines = cuisinePrefs
    .filter((c) => c.level === "LOVE")
    .map((c) => c.cuisine.toLowerCase().replace(/_/g, " "));
  const likedCuisines = cuisinePrefs
    .filter((c) => c.level === "LIKE")
    .map((c) => c.cuisine.toLowerCase().replace(/_/g, " "));
  const avoidCuisines = cuisinePrefs
    .filter((c) => c.level === "AVOID" || c.level === "DISLIKE")
    .map((c) => c.cuisine.toLowerCase().replace(/_/g, " "));

  const userPrompt = `Please create EXACTLY ${
    request.numRecipes || 10
  } dinner recipes for a meal plan with the following requirements:

CRITICAL: Generate exactly ${
    request.numRecipes || 10
  } recipes, one per day. Create as many days as needed to reach this count.

Date Range: ${request.preferences.startDate} to ${request.preferences.endDate}
Household Size: ${request.preferences.householdSize || 4} people
Diet Style: ${request.preferences.dietStyle || "omnivore"}
Cooking Skill Level: ${request.preferences.cookingSkillLevel || "intermediate"}
Maximum Cooking Time: ${request.preferences.maxDinnerMinutes || 45} minutes

${
  request.preferences.goals && request.preferences.goals.length > 0
    ? `Goals: ${request.preferences.goals.join(", ")}`
    : ""
}

${
  request.preferences.allergies && request.preferences.allergies.length > 0
    ? `ALLERGIES (MUST AVOID): ${request.preferences.allergies.join(", ")}`
    : ""
}

${
  request.preferences.exclusions && request.preferences.exclusions.length > 0
    ? `Exclusions: ${request.preferences.exclusions.join(", ")}`
    : ""
}

${
  lovedCuisines.length > 0
    ? `Preferred Cuisines (LOVE): ${lovedCuisines.join(", ")}`
    : ""
}
${likedCuisines.length > 0 ? `Liked Cuisines: ${likedCuisines.join(", ")}` : ""}
${
  avoidCuisines.length > 0
    ? `Cuisines to Avoid: ${avoidCuisines.join(", ")}`
    : ""
}

${
  request.inventoryItems && request.inventoryItems.length > 0
    ? `Available Inventory Items (USE WISELY - quantities are limited):
${request.inventoryItems
  .map(
    (item) =>
      `- ${item.name}: ${item.quantity || "some"}${
        item.unit ? " " + item.unit : ""
      } available`
  )
  .join("\n")}

IMPORTANT INVENTORY INSTRUCTIONS:
- Try to incorporate inventory items into recipes when appropriate
- Track quantities carefully - if recipe 1 uses 2 eggs and you only have 6 eggs total, recipes 2-${
        request.numRecipes || 10
      } can use at most 4 eggs combined
- Always list ALL ingredients for each recipe (including both inventory and non-inventory items)
- If an inventory item runs out, don't use it in remaining recipes
- Prioritize using inventory items that will spoil soon (fresh produce, meats, dairy)
- Don't force inventory items into recipes where they don't fit naturally`
    : `No inventory items available. Include all necessary ingredients for each recipe.`
}

${
  request.preferencesExplanation
    ? `\nSummary: ${request.preferencesExplanation}`
    : ""
}

${
  request.preferences.budget
    ? `Budget Consideration: ${request.preferences.budget}`
    : ""
}
${
  request.preferences.nutritionGoals &&
  request.preferences.nutritionGoals.length > 0
    ? `Nutrition Goals: ${request.preferences.nutritionGoals.join(", ")}`
    : ""
}
${
  request.preferences.mealPrepStyle
    ? `Meal Prep Style: ${request.preferences.mealPrepStyle}`
    : ""
}
${
  request.preferences.kitchenEquipment &&
  request.preferences.kitchenEquipment.length > 0
    ? `Available Kitchen Equipment: ${request.preferences.kitchenEquipment.join(
        ", "
      )}`
    : ""
}
${
  request.preferences.favoriteMeals &&
  request.preferences.favoriteMeals.length > 0
    ? `Favorite Meals: ${request.preferences.favoriteMeals.join(", ")}`
    : ""
}
${
  request.preferences.flavorPreferences &&
  request.preferences.flavorPreferences.length > 0
    ? `Flavor Preferences: ${request.preferences.flavorPreferences.join(", ")}`
    : ""
}

Please return a complete meal plan in JSON format with recipes that match these preferences.`;

  const response = await client.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      { role: "system", content: MEAL_PLAN_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
    max_tokens: 4096, // Increased to handle 10+ recipes with full details
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw errors.internal("Failed to generate meal plan");
  }

  // Validate JSON before parsing to provide better error messages
  try {
    return JSON.parse(content);
  } catch {
    console.error("Failed to parse meal plan JSON:", content);
    throw errors.internal(
      `Failed to parse meal plan response. The AI returned malformed JSON. Please try again.`
    );
  }
}

// Helper to call OpenAI for recipe replacement
export async function generateReplaceRecipe(request: ReplaceRecipeRequest) {
  const client = getOpenAIClient();

  // Format cuisine preferences if available
  const cuisinePrefs = request.preferences?.cuisinePreferences || [];
  const lovedCuisines = cuisinePrefs
    .filter((c) => c.level === "LOVE")
    .map((c) => c.cuisine.toLowerCase().replace(/_/g, " "));
  const avoidCuisines = cuisinePrefs
    .filter((c) => c.level === "AVOID" || c.level === "DISLIKE")
    .map((c) => c.cuisine.toLowerCase().replace(/_/g, " "));

  const userPrompt = `Please suggest a replacement recipe for:

Original Recipe: ${request.originalRecipe.title}
${
  request.originalRecipe.totalMinutes
    ? `Original Time: ${request.originalRecipe.totalMinutes} minutes`
    : ""
}
${
  request.originalRecipe.ingredients
    ? `Original Ingredients: ${JSON.stringify(
        request.originalRecipe.ingredients
      )}`
    : ""
}

Reason for Replacement: ${request.replacementReason}

${
  request.preferences
    ? `
User Requirements:
${
  request.preferences.householdSize
    ? `Household Size: ${request.preferences.householdSize} people`
    : ""
}
${
  request.preferences.dietStyle
    ? `Diet Style: ${request.preferences.dietStyle}`
    : ""
}
${
  request.preferences.cookingSkillLevel
    ? `Cooking Skill Level: ${request.preferences.cookingSkillLevel}`
    : ""
}
${
  request.preferences.maxDinnerMinutes
    ? `Maximum Cooking Time: ${request.preferences.maxDinnerMinutes} minutes`
    : ""
}
${
  request.preferences.allergies && request.preferences.allergies.length > 0
    ? `ALLERGIES (MUST AVOID): ${request.preferences.allergies.join(", ")}`
    : ""
}
${
  request.preferences.exclusions && request.preferences.exclusions.length > 0
    ? `Exclusions: ${request.preferences.exclusions.join(", ")}`
    : ""
}
${
  lovedCuisines.length > 0
    ? `Preferred Cuisines: ${lovedCuisines.join(", ")}`
    : ""
}
${
  avoidCuisines.length > 0
    ? `Cuisines to Avoid: ${avoidCuisines.join(", ")}`
    : ""
}
`
    : ""
}

Please return a complete replacement recipe in JSON format.`;

  const response = await client.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      { role: "system", content: REPLACE_RECIPE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw errors.internal("Failed to generate replacement recipe");
  }

  return JSON.parse(content);
}

// Parse and validate meal plan response
export function parseMealPlanResponse(response: unknown) {
  // TODO: Add Zod schema validation for meal plan structure
  return response;
}

// Parse and validate recipe response
export function parseRecipeResponse(response: unknown) {
  // TODO: Add Zod schema validation for recipe structure
  return response;
}

// ============================================================================
// HYBRID GENERATION FUNCTIONS (Database + AI)
// ============================================================================

import {
  searchRecipesByPreferences,
  getRecentlyUsedRecipes, // Currently unused (exclusion disabled for dev)
  getTotalRecipeCount,
  searchRecipeByQuery,
  searchRecipesByTags,
  getRandomRecipes,
  selectDiverseRecipes,
  type RecipeWithSimilarity,
} from "./recipe-search-utils";

interface HybridMealPlanResult {
  mealPlan: MealPlanStructure;
  recipesFromDatabase: number;
  recipesGenerated: number;
  costSavingsEstimate: string;
}

/**
 * Generate meal plan using hybrid approach (database + AI)
 * Phase 1: Search database for matching recipes
 * Phase 2: Quality check with AI
 * Phase 3: Fill gaps with AI generation
 * Phase 4: Deduplicate and finalize
 */
export async function generateHybridMealPlan(
  request: MealPlanRequest,
  userId: string
): Promise<HybridMealPlanResult> {
  const numRecipes = request.numRecipes || 10;

  // PHASE 1: Database Recipe Search
  // Strategy: Always aim for 50/50 split (half DB, half AI)
  const totalRecipes = await getTotalRecipeCount();

  // Target half from database, half from AI
  const targetDbRecipes = Math.min(Math.floor(numRecipes / 2), totalRecipes);
  const targetAIRecipes = numRecipes - targetDbRecipes;

  console.log(
    `Target: ${targetDbRecipes} from DB, ${targetAIRecipes} from AI (total: ${numRecipes})`
  );

  let dbRecipes: RecipeWithSimilarity[] = [];

  if (targetDbRecipes === 0) {
    console.log("No recipes in database, will generate all with AI");
  } else {
    // RECIPE EXCLUSION DISABLED FOR DEVELOPMENT
    // Uncomment this when your database is more populated (100+ recipes)
    // to avoid repeating recently used recipes

    // // Smart exclusion strategy: don't exclude more than 50% of database
    // let recentlyUsed = await getRecentlyUsedRecipes(userId, 14);
    //
    // // If we're excluding too many recipes, reduce the exclusion period
    // if (recentlyUsed.length > totalRecipes * 0.5) {
    //   console.log(
    //     `⚠️  Recently used (${recentlyUsed.length}) exceeds 50% of database (${totalRecipes}), trying shorter period...`
    //   );
    //   recentlyUsed = await getRecentlyUsedRecipes(userId, 7);
    //
    //   // If still too many, try last 3 days
    //   if (recentlyUsed.length > totalRecipes * 0.5) {
    //     console.log(
    //       `⚠️  Still too many (${recentlyUsed.length}), trying last 3 days...`
    //     );
    //     recentlyUsed = await getRecentlyUsedRecipes(userId, 3);
    //
    //     // If STILL too many, only exclude very recent (last day)
    //     if (recentlyUsed.length > totalRecipes * 0.5) {
    //       console.log(
    //         `⚠️  Still too many (${recentlyUsed.length}), using last 1 day only...`
    //       );
    //       recentlyUsed = await getRecentlyUsedRecipes(userId, 1);
    //     }
    //   }
    // }
    //
    // console.log(
    //   `Excluding ${recentlyUsed.length} recently used recipes (from last ${
    //     recentlyUsed.length > totalRecipes * 0.5 ? "1 day" : "14 days"
    //   })`
    // );

    const recentlyUsed: string[] = []; // Empty for now
    console.log("📝 Recipe exclusion disabled (dev mode)");

    const searchLimit = targetDbRecipes * 3; // Search more to have options

    // STEP 1: Try semantic/embedding search first
    console.log("\n🔍 Step 1: Trying semantic search with embeddings...");
    console.log(`  - Search limit: ${searchLimit}`);
    console.log(`  - Min similarity: 0.3`);
    console.log(
      `  - Allergies: ${request.preferences.allergies?.join(", ") || "none"}`
    );
    console.log(
      `  - Exclusions: ${request.preferences.exclusions?.join(", ") || "none"}`
    );
    console.log(
      `  - Max minutes: ${request.preferences.maxDinnerMinutes || "none"}`
    );

    let candidates = await searchRecipesByPreferences(request.preferences, {
      limit: searchLimit,
      excludeRecipeIds: recentlyUsed,
      minSimilarity: 0.3,
    });

    console.log(`Found ${candidates.length} recipes via semantic search`);

    // STEP 2: If no results, fallback to tag-based search
    if (candidates.length === 0 && request.preferences.cuisinePreferences) {
      console.log(
        "\n🏷️  Step 2: Semantic search failed, trying tag-based search..."
      );
      candidates = await searchRecipesByTags(
        request.preferences.cuisinePreferences,
        {
          limit: searchLimit,
          excludeRecipeIds: recentlyUsed,
        }
      );
      console.log(`Found ${candidates.length} recipes via tag search`);
    }

    // STEP 3: If still no results, get random recipes
    if (candidates.length === 0) {
      console.log(
        "\n🎲 Step 3: Tag search failed, selecting random recipes..."
      );
      candidates = await getRandomRecipes(searchLimit, {
        excludeRecipeIds: recentlyUsed,
      });
      console.log(`Found ${candidates.length} random recipes`);
    }

    // Debug: Show top matches
    if (candidates.length > 0) {
      console.log("\n✅ Top matches:");
      candidates.slice(0, 5).forEach((c, i) => {
        const tags = c.tags as string[] | null;
        console.log(
          `  ${i + 1}. ${c.title} (similarity: ${c.similarity.toFixed(
            3
          )}, tags: ${tags?.join(", ") || "none"})`
        );
      });
    }

    // STEP 4: Apply dietary restrictions filter
    const { hasDietaryRestrictions, doesRecipeMeetDietaryRestrictions } =
      await import("./recipe-search-utils");

    if (
      hasDietaryRestrictions({
        dietStyle: request.preferences.dietStyle,
        allergies: request.preferences.allergies,
        exclusions: request.preferences.exclusions,
      })
    ) {
      console.log("\n🚨 Dietary restrictions detected - filtering recipes...");
      console.log(`  - Diet style: ${request.preferences.dietStyle || "none"}`);
      console.log(
        `  - Allergies: ${request.preferences.allergies?.join(", ") || "none"}`
      );
      console.log(
        `  - Exclusions: ${
          request.preferences.exclusions?.join(", ") || "none"
        }`
      );

      const beforeCount = candidates.length;
      candidates = candidates.filter((recipe) =>
        doesRecipeMeetDietaryRestrictions(recipe, {
          dietStyle: request.preferences.dietStyle,
          allergies: request.preferences.allergies,
          exclusions: request.preferences.exclusions,
        })
      );

      console.log(
        `Filtered ${beforeCount} → ${candidates.length} recipes for dietary compliance`
      );

      // If we don't have enough compliant recipes, adjust targets
      if (candidates.length < targetDbRecipes) {
        console.log(
          `⚠️  Only ${candidates.length} compliant recipes available (needed ${targetDbRecipes})`
        );
        console.log(
          `   Will use ${candidates.length} from DB and generate ${
            numRecipes - candidates.length
          } with AI`
        );
      }
    }

    // Select diverse recipes (avoid duplicates/very similar recipes)
    console.log("\n🎨 Applying diversity filter...");
    dbRecipes = selectDiverseRecipes(candidates, targetDbRecipes, {
      titleSimilarityThreshold: 0.6, // 60% word overlap
      ingredientOverlapThreshold: 0.7, // 70% ingredient overlap
    });

    console.log(
      `\n✓ Selected ${dbRecipes.length} diverse recipes from database\n`
    );
  }

  // PHASE 2: Generate remaining recipes with AI
  const remainingNeeded = numRecipes - dbRecipes.length;
  const aiGeneratedRecipes: RecipeWithSimilarity[] = [];

  if (remainingNeeded > 0) {
    console.log(`\n🤖 Generating ${remainingNeeded} recipes with AI...`);

    // Generate remaining recipes with AI
    const modifiedRequest = {
      ...request,
      numRecipes: remainingNeeded,
    };

    const aiMealPlan = await generateMealPlan(modifiedRequest);

    // Extract recipes from AI response
    if (aiMealPlan.days && Array.isArray(aiMealPlan.days)) {
      console.log(`AI returned ${aiMealPlan.days.length} days`);
      for (const day of aiMealPlan.days) {
        if (day.meals) {
          const mealTypes = ["breakfast", "lunch", "dinner"];
          for (const mealType of mealTypes) {
            const meal = day.meals[mealType];
            if (meal && meal.title) {
              aiGeneratedRecipes.push(meal as RecipeWithSimilarity);
            }
          }
        }
      }
    }

    console.log(
      `AI generated ${aiGeneratedRecipes.length} recipes (requested ${remainingNeeded})`
    );
  }

  // PHASE 3: Combine and finalize
  const allRecipes = [...dbRecipes, ...aiGeneratedRecipes];

  // Deduplicate recipes within the same meal plan
  const finalRecipes: RecipeWithSimilarity[] = [];
  const seenTitles = new Set<string>();

  for (const recipe of allRecipes) {
    const normalizedTitle = recipe.title.toLowerCase().trim();

    if (!seenTitles.has(normalizedTitle)) {
      finalRecipes.push(recipe);
      seenTitles.add(normalizedTitle);
    } else {
      console.log(
        `⚠️  Skipping duplicate recipe in meal plan: ${recipe.title}`
      );
    }
  }

  // If we filtered out duplicates and don't have enough, generate more
  if (finalRecipes.length < numRecipes) {
    const stillNeeded = numRecipes - finalRecipes.length;
    console.log(
      `⚠️  Need ${stillNeeded} more recipes after deduplication, generating additional recipes...`
    );

    // Generate additional recipes to fill the gap
    const additionalRequest = {
      ...request,
      numRecipes: stillNeeded,
    };

    try {
      const additionalMealPlan = await generateMealPlan(additionalRequest);

      // Extract recipes from the additional generation
      if (additionalMealPlan.days && Array.isArray(additionalMealPlan.days)) {
        for (const day of additionalMealPlan.days) {
          if (day.meals) {
            const mealTypes = ["breakfast", "lunch", "dinner"];
            for (const mealType of mealTypes) {
              const meal = day.meals[mealType];
              if (meal && meal.title) {
                const normalizedTitle = meal.title.toLowerCase().trim();

                // Check if this new recipe is also a duplicate
                if (!seenTitles.has(normalizedTitle)) {
                  finalRecipes.push(meal as RecipeWithSimilarity);
                  seenTitles.add(normalizedTitle);

                  // Stop once we have enough
                  if (finalRecipes.length >= numRecipes) {
                    break;
                  }
                } else {
                  console.log(
                    `⚠️  Additional recipe also duplicate: ${meal.title}`
                  );
                }
              }
            }
            if (finalRecipes.length >= numRecipes) break;
          }
        }
      }

      console.log(
        `✓ Generated ${stillNeeded} additional recipes (total: ${finalRecipes.length})`
      );
    } catch (error) {
      console.error("❌ Failed to generate additional recipes:", error);
      // Continue with what we have
    }
  }

  // Build final meal plan structure
  console.log(
    `Building meal plan with ${finalRecipes.length} recipes (${dbRecipes.length} from DB, ${aiGeneratedRecipes.length} from AI)`
  );
  const mealPlan = buildMealPlanFromRecipes(
    finalRecipes.slice(0, numRecipes),
    request.preferences.startDate,
    request.preferences.endDate
  );
  console.log(`Meal plan created with ${mealPlan.days.length} days`);

  // Calculate cost savings
  const dbRecipeCount = finalRecipes.filter((r) =>
    dbRecipes.some((db) => db.id === r.id)
  ).length;
  const aiRecipeCount = finalRecipes.length - dbRecipeCount;
  const estimatedCostPerRecipe = 0.05; // Rough estimate
  const costSaved = dbRecipeCount * estimatedCostPerRecipe;

  return {
    mealPlan,
    recipesFromDatabase: dbRecipeCount,
    recipesGenerated: aiRecipeCount,
    costSavingsEstimate: `$${costSaved.toFixed(2)} saved`,
  };
}

interface MealPlanDay {
  date: string;
  meals: {
    dinner: RecipeWithSimilarity | null;
  };
}

interface MealPlanStructure {
  startDate: string;
  endDate: string;
  days: MealPlanDay[];
}

/**
 * Build meal plan structure from recipes
 * Creates as many days as needed to include all recipes
 */
function buildMealPlanFromRecipes(
  recipes: RecipeWithSimilarity[],
  startDate: string,
  _endDate: string
): MealPlanStructure {
  const start = new Date(startDate);
  const days: MealPlanDay[] = [];

  let recipeIndex = 0;
  const currentDate = new Date(start);

  // Create days for all recipes, extending beyond endDate if necessary
  while (recipeIndex < recipes.length) {
    const dateStr = currentDate.toISOString().split("T")[0];

    days.push({
      date: dateStr,
      meals: {
        dinner: recipes[recipeIndex] || null,
      },
    });

    recipeIndex++;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate actual end date (may extend beyond requested endDate)
  const actualEndDate = new Date(currentDate);
  actualEndDate.setDate(actualEndDate.getDate() - 1); // Go back one day since we incremented after last recipe

  return {
    startDate,
    endDate: actualEndDate.toISOString().split("T")[0],
    days,
  };
}

/**
 * Generate recipe replacement using hybrid approach
 */
export async function generateHybridReplacement(
  request: ReplaceRecipeRequest
): Promise<{ recipe: RecipeWithSimilarity; source: "database" | "ai" }> {
  // Search database first
  const candidates = await searchRecipeByQuery(
    `${request.replacementReason} alternative to ${request.originalRecipe.title}`,
    {
      limit: 10, // Get more candidates since we'll filter out the original
      excludeRecipeIds: [], // Could exclude the original if we had the ID
      minSimilarity: 0.7,
    }
  );

  // Filter out the original recipe and similar recipes by title
  const originalTitleNormalized = request.originalRecipe.title
    .toLowerCase()
    .trim();
  const originalWords = new Set(
    originalTitleNormalized.split(/\s+/).filter((w) => w.length > 2) // Ignore short words like "to", "a", etc.
  );

  // Check if user wants something truly different (different cuisine)
  const wantsDifferentCuisine = /different|variety|change|new|else/i.test(
    request.replacementReason
  );

  let filtered = candidates.filter((recipe) => {
    const recipeTitleNormalized = recipe.title.toLowerCase().trim();

    // Exact match - definitely exclude
    if (recipeTitleNormalized === originalTitleNormalized) {
      return false;
    }

    // Check title similarity - if they share most words, they're too similar
    const recipeWords = recipeTitleNormalized
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const commonWords = recipeWords.filter((word) => originalWords.has(word));
    // Use minimum to catch cases where one title is a subset of another
    // E.g., "Chicken Fajitas" vs "Chicken Fajitas with Bell Peppers" = 100% similar
    const similarity =
      commonWords.length / Math.min(originalWords.size, recipeWords.length);

    // If more than 60% of words overlap, consider it too similar
    if (similarity > 0.6) {
      console.log(
        `  Excluding similar recipe: "${recipe.title}" (${(
          similarity * 100
        ).toFixed(0)}% similar to "${request.originalRecipe.title}")`
      );
      return false;
    }

    return true;
  });

  console.log(
    `Found ${candidates.length} candidates, ${
      filtered.length
    } after excluding original and similar recipes${
      wantsDifferentCuisine ? " (user wants different cuisine)" : ""
    }`
  );

  // Further filter by preferences if provided
  if (request.preferences && filtered.length > 0) {
    filtered = filtered.filter((recipe) => {
      // Check cooking time
      if (
        request.preferences?.maxDinnerMinutes &&
        recipe.totalMinutes &&
        recipe.totalMinutes > request.preferences.maxDinnerMinutes
      ) {
        return false;
      }

      // Check allergies
      if (request.preferences?.allergies) {
        const ingredients = recipe.ingredients as Array<{ name: string }>;
        const hasAllergen = ingredients?.some((ing) =>
          request.preferences?.allergies?.some((allergen) =>
            ing.name.toLowerCase().includes(allergen.toLowerCase())
          )
        );
        if (hasAllergen) return false;
      }

      return true;
    });
  }

  if (filtered.length > 0) {
    console.log(
      `Found suitable replacement from database: ${filtered[0].title}`
    );
    return {
      recipe: filtered[0],
      source: "database",
    };
  }

  // No suitable match found, generate with AI
  console.log("No suitable replacement found in database, using AI");
  const aiRecipe = await generateReplaceRecipe(request);

  return {
    recipe: aiRecipe,
    source: "ai",
  };
}

/**
 * Generate single recipe using hybrid approach
 */
export async function generateHybridRecipe(
  query: string,
  preferences?: {
    maxMinutes?: number;
    dietStyle?: string;
    allergies?: string[];
  }
): Promise<{ recipe: RecipeWithSimilarity; source: "database" | "ai" }> {
  // Search database first
  const candidates = await searchRecipeByQuery(query, {
    limit: 5,
    minSimilarity: 0.7,
  });

  // Filter by preferences
  let filtered = candidates;
  if (preferences) {
    filtered = candidates.filter((recipe) => {
      if (
        preferences.maxMinutes &&
        recipe.totalMinutes &&
        recipe.totalMinutes > preferences.maxMinutes
      ) {
        return false;
      }

      if (preferences.allergies) {
        const ingredients = recipe.ingredients as Array<{ name: string }>;
        const hasAllergen = ingredients?.some((ing) =>
          preferences.allergies?.some((allergen) =>
            ing.name.toLowerCase().includes(allergen.toLowerCase())
          )
        );
        if (hasAllergen) return false;
      }

      return true;
    });
  }

  if (filtered.length > 0) {
    console.log(
      `Found suitable recipe from database: ${
        filtered[0].title
      } (similarity: ${filtered[0].similarity.toFixed(2)})`
    );
    return {
      recipe: filtered[0],
      source: "database",
    };
  }

  // No suitable match found, would generate with AI
  // For now, return null - you'll need to implement AI generation for single recipes
  console.log("No suitable recipe found in database");
  throw new Error(
    "No suitable recipe found in database. AI generation for single recipes not yet implemented."
  );
}

// System prompt for recipe parsing from URLs
export const PARSE_RECIPE_SYSTEM_PROMPT = `You are an expert at extracting and parsing recipe information from web pages. Your role is to accurately extract structured recipe data from HTML content.

When parsing recipes:
1. Extract the recipe title accurately (without cuisine type prefix)
2. Identify all ingredients with their quantities and units
3. Extract step-by-step instructions in order
4. Determine serving size if mentioned
5. Calculate or extract total cooking time (prep + cook)
6. Identify relevant tags/categories (cuisine type, meal type, dietary info)
7. Detect the cuisine type based on ingredients, techniques, and recipe context
8. Extract the recipe description or summary
9. Extract the recipe image URL if available from:
   - Open Graph meta tags (og:image)
   - Recipe schema.org markup (image property)
   - Featured image or main recipe photo

Return the parsed recipe in JSON format with:
- title (string, WITHOUT cuisine type prefix)
- description (string, if available)
- imageUrl (string, URL to recipe image if available)
- servings (number, if available)
- totalMinutes (number, total time in minutes if available)
- cuisine (string, REQUIRED - detected cuisine type such as "Italian", "Mexican", "Japanese", "Chinese", "Thai", "Indian", "Mediterranean", "Korean", "American", "French", "Middle Eastern", "Caribbean", or "Other" if unclear)
- tags (array of strings for categorization)
- ingredients (array of objects with EXACT structure):
  * name (string, the ingredient name as displayed)
  * qty (number, optional - quantity if specified)
  * unit (string, optional - measurement unit)
  * notes (string, optional - preparation notes)
  * canonicalId (string, REQUIRED - lowercase, underscore_separated version of ingredient name)
- steps (array of objects with: order (number), text (string))

Example ingredient:
{
  "name": "all-purpose flour",
  "qty": 2,
  "unit": "cups",
  "canonicalId": "all_purpose_flour"
}

If information is not clearly stated, use your best judgment or omit the field. Focus on accuracy over completeness.`;

// Helper to fetch and parse recipe from URL
export async function parseRecipeFromUrl(url: string) {
  const client = getOpenAIClient();

  // Fetch the HTML content from the URL
  let htmlContent: string;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PersonalChefBot/1.0; +https://personalchef.app)",
      },
    });

    if (!response.ok) {
      throw errors.badRequest(
        `Failed to fetch URL: ${response.status} ${response.statusText}`
      );
    }

    htmlContent = await response.text();

    // Limit HTML size to prevent token overflow (approx 50KB)
    if (htmlContent.length > 50000) {
      htmlContent = htmlContent.substring(0, 50000);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("fetch")) {
      throw errors.badRequest("Unable to fetch recipe from URL");
    }
    throw error;
  }

  const userPrompt = `Please extract the recipe from the following web page content:

URL: ${url}

HTML Content:
${htmlContent}

Please return the parsed recipe in JSON format with all available information.`;

  const response = await client.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      { role: "system", content: PARSE_RECIPE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3, // Lower temperature for more accurate extraction
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw errors.internal("Failed to parse recipe from URL");
  }

  return JSON.parse(content);
}
