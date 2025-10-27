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
