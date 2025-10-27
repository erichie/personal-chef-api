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
  - title (recipe name - include sides in title if applicable, e.g., "Grilled Chicken with Roasted Vegetables")
  - description (brief description mentioning both main and sides)
  - servings (number of servings)
  - totalMinutes (total cooking time including sides)
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
2. Suggest recipes with similar flavor profiles or nutritional values
3. Ensure the replacement fits the user's dietary restrictions and preferences
4. Consider their cooking skill level and available equipment
5. Maintain or improve upon the original recipe's appeal
6. Provide clear, detailed instructions
7. List all ingredients with quantities

Return the replacement recipe in JSON format with:
- title, description, servings, totalMinutes
- ingredients array with EXACT structure:
  * name (string, the ingredient name as displayed)
  * qty (number, optional - quantity if specified)
  * unit (string, optional - measurement unit like "cup", "lb", "tsp")
  * notes (string, optional - preparation notes like "grated", "chopped")
  * canonicalId (string, REQUIRED - lowercase, underscore_separated version of ingredient name for matching)
- steps array with order (number) and text (string)
- tags for categorization

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

  const userPrompt = `Please create ${
    request.numRecipes || 10
  } dinner recipes for a meal plan with the following requirements:

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

Please return a complete meal plan in JSON format with recipes that match these preferences.`;

  const response = await client.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      { role: "system", content: MEAL_PLAN_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
    max_tokens: 4096, // Maximum for gpt-4-turbo-preview
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
  getRecentlyUsedRecipes,
  // isDuplicateRecipe, // Temporarily disabled for testing
  getTotalRecipeCount,
  searchRecipeByQuery,
} from "./recipe-search-utils";
// import { generateRecipeEmbedding } from "./embedding-utils"; // Temporarily disabled for testing

interface HybridMealPlanResult {
  mealPlan: any;
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
  const totalRecipes = await getTotalRecipeCount();

  let dbRecipes: any[] = [];
  let targetDbRecipes = 0;

  // Edge case: Not enough recipes in database
  if (totalRecipes < 20) {
    console.log(`Only ${totalRecipes} recipes in database, skipping DB search`);
  } else {
    // Get recently used recipes to exclude
    const recentlyUsed = await getRecentlyUsedRecipes(userId, 14);

    // Search for matching recipes (target 60-70% from DB)
    targetDbRecipes = Math.floor(numRecipes * 0.65);
    const searchLimit = targetDbRecipes * 3; // Search more to have options

    const candidates = await searchRecipesByPreferences(request.preferences, {
      limit: searchLimit,
      userId,
      excludeRecipeIds: recentlyUsed,
      minSimilarity: 0.5,
    });

    console.log(
      `Found ${candidates.length} candidate recipes from database (similarity >= 0.5)`
    );

    // Edge case: Not enough good matches
    if (candidates.length < 3) {
      console.log("Too few matches, will rely more on AI generation");
      targetDbRecipes = candidates.length;
    }

    // PHASE 2: Quality Check (simplified - just use top matches)
    // In a more sophisticated version, we could use AI to rate these
    // For now, we trust the similarity scores
    dbRecipes = candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, targetDbRecipes);

    console.log(`Selected ${dbRecipes.length} recipes from database`);
  }

  // PHASE 3: Fill Gaps with AI Generation
  const remainingNeeded = numRecipes - dbRecipes.length;
  let aiGeneratedRecipes: any[] = [];

  if (remainingNeeded > 0) {
    console.log(`Generating ${remainingNeeded} recipes with AI`);

    // Build exclusion list for AI prompt
    const existingTitles = dbRecipes.map((r) => r.title);
    const existingIngredientSets = dbRecipes.map((r) => {
      const ingredients = r.ingredients as Array<{ name: string }>;
      return ingredients.map((ing) => ing.name).join(", ");
    });

    const exclusionPrompt =
      existingTitles.length > 0
        ? `\n\nIMPORTANT: Avoid creating recipes too similar to these existing ones:
${existingTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
        : "";

    // Generate remaining recipes with AI
    const modifiedRequest = {
      ...request,
      numRecipes: remainingNeeded,
    };

    const aiMealPlan = await generateMealPlan(modifiedRequest);

    // Extract recipes from AI response
    if (aiMealPlan.days && Array.isArray(aiMealPlan.days)) {
      for (const day of aiMealPlan.days) {
        if (day.meals) {
          const mealTypes = ["breakfast", "lunch", "dinner"];
          for (const mealType of mealTypes) {
            const meal = day.meals[mealType];
            if (meal && meal.title) {
              aiGeneratedRecipes.push(meal);
            }
          }
        }
      }
    }

    console.log(`AI generated ${aiGeneratedRecipes.length} recipes`);
  }

  // PHASE 4: Deduplicate & Finalize
  const allRecipes = [...dbRecipes, ...aiGeneratedRecipes];
  let finalRecipes: any[] = [];
  // let seenRecipes: Array<{ title: string; ingredients: any }> = []; // Temporarily disabled for testing

  // DUPLICATE DETECTION TEMPORARILY DISABLED FOR TESTING
  // The AI is instructed to avoid duplicates, so let's test if that's sufficient
  // Uncomment this section if AI generates too many similar recipes

  // First pass: deduplicate
  // for (const recipe of allRecipes) {
  //   const ingredients = recipe.ingredients || [];

  //   if (!isDuplicateRecipe(recipe.title, ingredients, seenRecipes)) {
  //     finalRecipes.push(recipe);
  //     seenRecipes.push({ title: recipe.title, ingredients });
  //   } else {
  //     console.log(`Skipping duplicate recipe: ${recipe.title}`);
  //   }
  // }

  // Without duplicate detection, just use all recipes
  finalRecipes = allRecipes;

  // REGENERATION LOGIC ALSO DISABLED FOR TESTING
  // If we filtered out duplicates and don't have enough, generate more
  // if (finalRecipes.length < numRecipes) {
  //   const stillNeeded = numRecipes - finalRecipes.length;
  //   console.log(
  //     `Need ${stillNeeded} more recipes after deduplication, generating...`
  //   );

  //   // Get titles of recipes we already have to avoid in new generation
  //   const existingTitles = finalRecipes.map((r) => r.title);

  //   // Generate additional recipes to fill the gap
  //   const additionalRequest = {
  //     ...request,
  //     numRecipes: stillNeeded,
  //   };

  //   try {
  //     const additionalMealPlan = await generateMealPlan(additionalRequest);

  //     // Extract recipes from the additional generation
  //     if (additionalMealPlan.days && Array.isArray(additionalMealPlan.days)) {
  //       for (const day of additionalMealPlan.days) {
  //         if (day.meals) {
  //           const mealTypes = ["breakfast", "lunch", "dinner"];
  //           for (const mealType of mealTypes) {
  //             const meal = day.meals[mealType];
  //             if (meal && meal.title) {
  //               // Check if this new recipe is also a duplicate
  //               if (
  //                 !isDuplicateRecipe(
  //                   meal.title,
  //                   meal.ingredients || [],
  //                   seenRecipes
  //                 )
  //               ) {
  //                 finalRecipes.push(meal);
  //                 seenRecipes.push({
  //                   title: meal.title,
  //                   ingredients: meal.ingredients,
  //                 });

  //                 // Stop once we have enough
  //                 if (finalRecipes.length >= numRecipes) {
  //                   break;
  //                 }
  //               } else {
  //                 console.log(
  //                   `Additional recipe also duplicate: ${meal.title}`
  //                 );
  //               }
  //             }
  //           }
  //           if (finalRecipes.length >= numRecipes) break;
  //         }
  //       }
  //     }

  //     console.log(
  //       `Generated ${
  //         finalRecipes.length - (numRecipes - stillNeeded)
  //       } additional recipes`
  //     );
  //   } catch (error) {
  //     console.error("Failed to generate additional recipes:", error);
  //     // Continue with what we have
  //   }
  // }

  // Build final meal plan structure
  const mealPlan = buildMealPlanFromRecipes(
    finalRecipes.slice(0, numRecipes),
    request.preferences.startDate,
    request.preferences.endDate
  );

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

/**
 * Build meal plan structure from recipes
 */
function buildMealPlanFromRecipes(
  recipes: any[],
  startDate: string,
  endDate: string
): any {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days: any[] = [];

  let recipeIndex = 0;
  const currentDate = new Date(start);

  while (currentDate <= end && recipeIndex < recipes.length) {
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

  return {
    startDate,
    endDate,
    days,
  };
}

/**
 * Generate recipe replacement using hybrid approach
 */
export async function generateHybridReplacement(
  request: ReplaceRecipeRequest
): Promise<{ recipe: any; source: "database" | "ai" }> {
  // Search database first
  const { generateReplacementEmbedding } = await import("./embedding-utils");

  const candidates = await searchRecipeByQuery(
    `${request.replacementReason} alternative to ${request.originalRecipe.title}`,
    {
      limit: 5,
      excludeRecipeIds: [], // Could exclude the original if we had the ID
      minSimilarity: 0.7,
    }
  );

  // Filter by preferences if provided
  let filtered = candidates;
  if (request.preferences) {
    filtered = candidates.filter((recipe) => {
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
): Promise<{ recipe: any; source: "database" | "ai" }> {
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
1. Extract the recipe title accurately
2. Identify all ingredients with their quantities and units
3. Extract step-by-step instructions in order
4. Determine serving size if mentioned
5. Calculate or extract total cooking time (prep + cook)
6. Identify relevant tags/categories (cuisine type, meal type, dietary info)
7. Extract the recipe description or summary

Return the parsed recipe in JSON format with:
- title (string)
- description (string, if available)
- servings (number, if available)
- totalMinutes (number, total time in minutes if available)
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
