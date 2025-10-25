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
7. Incorporate items from their inventory when possible

Return meal plans in a structured JSON format with:
- startDate and endDate
- days array with date and meals (breakfast, lunch, dinner)
- Each meal should have: id, title, servings, totalMinutes, and basic recipe details
- Include a grocery list with items needed that aren't in inventory

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
- ingredients array with name, quantity, unit, notes
- steps array with order and text
- tags for categorization

Be helpful, creative, and make sure the replacement is genuinely appealing!`;

// Type definitions for AI requests/responses
export interface MealPlanRequest {
  preferences: {
    chefIntake?: any;
    startDate: string;
    endDate: string;
    mealsPerDay?: string[];
    includeInventory?: boolean;
  };
  inventory?: any[];
}

export interface ReplaceRecipeRequest {
  originalRecipe: {
    title: string;
    ingredients?: any[];
    totalMinutes?: number;
  };
  replacementReason: string;
  preferences?: any;
}

// Helper to call OpenAI for meal plan generation
export async function generateMealPlan(request: MealPlanRequest) {
  const client = getOpenAIClient();

  const userPrompt = `Please create a meal plan with the following requirements:

Start Date: ${request.preferences.startDate}
End Date: ${request.preferences.endDate}
Meals per day: ${
    request.preferences.mealsPerDay?.join(", ") || "breakfast, lunch, dinner"
  }

User Preferences:
${JSON.stringify(request.preferences.chefIntake, null, 2)}

${
  request.inventory && request.inventory.length > 0
    ? `Available Inventory:\n${JSON.stringify(request.inventory, null, 2)}`
    : ""
}

Please return a complete meal plan in JSON format.`;

  const response = await client.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      { role: "system", content: MEAL_PLAN_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw errors.internal("Failed to generate meal plan");
  }

  return JSON.parse(content);
}

// Helper to call OpenAI for recipe replacement
export async function generateReplaceRecipe(request: ReplaceRecipeRequest) {
  const client = getOpenAIClient();

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
    ? `User Preferences:\n${JSON.stringify(request.preferences, null, 2)}`
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
export function parseMealPlanResponse(response: any) {
  // TODO: Add Zod schema validation for meal plan structure
  return response;
}

// Parse and validate recipe response
export function parseRecipeResponse(response: any) {
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
- ingredients (array of objects with: name, qty, unit, notes)
- steps (array of objects with: order, text)

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
