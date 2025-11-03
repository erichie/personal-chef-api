import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getOpenAIClient, generateHybridRecipe } from "@/lib/ai-utils";
import { searchRecipeByQuery } from "@/lib/recipe-search-utils";
import {
  trackAiUsage,
  AiEndpoint,
  checkGenerateRecipeLimit,
  validateUserTokens,
  MEAL_PLAN_TOKEN_COST,
} from "@/lib/ai-usage-utils";

// Request validation schema
const generateRecipeRequestSchema = z.object({
  // User's recipe request (for new recipes)
  prompt: z.string().optional(),

  // Existing recipe to refine (for refinement)
  existingRecipe: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      servings: z.number().optional(),
      totalMinutes: z.number().optional(),
      ingredients: z.array(
        z.object({
          name: z.string(),
          qty: z.union([z.number(), z.string()]).nullable().optional(),
          unit: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
        })
      ),
      steps: z
        .array(
          z.object({
            order: z.number(),
            text: z.string(),
          })
        )
        .optional(),
    })
    .optional(),

  // User preferences for context
  preferences: z
    .object({
      householdSize: z.number().optional(),
      dietStyle: z.string().optional(),
      allergies: z.array(z.string()).optional(),
      exclusions: z.array(z.string()).optional(),
      goals: z.array(z.string()).optional(),
      maxMinutes: z.number().optional(),
      cookingSkillLevel: z.string().optional(),
      cuisinePreferences: z
        .array(
          z.object({
            cuisine: z.string(),
            level: z.enum(["LOVE", "LIKE", "AVOID"]),
          })
        )
        .optional(),
    })
    .optional(),
  tokensToUse: z.number().optional(), // Optional: tokens to use to bypass limit
});

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload = generateRecipeRequestSchema.parse(body);

    // Validate that either prompt or existingRecipe is provided
    if (!payload.prompt && !payload.existingRecipe) {
      return NextResponse.json(
        { error: "Either prompt or existingRecipe must be provided" },
        { status: 400 }
      );
    }

    let usedTokens = false;

    // If tokens are provided, validate them instead of checking limit
    if (payload.tokensToUse !== undefined) {
      // Validate token amount is correct
      if (payload.tokensToUse !== MEAL_PLAN_TOKEN_COST) {
        return NextResponse.json(
          {
            error: "Invalid token amount",
            code: "INVALID_TOKEN_AMOUNT",
            details: {
              required: MEAL_PLAN_TOKEN_COST,
              provided: payload.tokensToUse,
            },
          },
          { status: 400 }
        );
      }

      // Validate user has enough tokens
      const tokenValidation = await validateUserTokens(
        user.id,
        MEAL_PLAN_TOKEN_COST
      );

      if (!tokenValidation.valid) {
        return NextResponse.json(
          {
            error: tokenValidation.error || "Insufficient tokens",
            code: "INSUFFICIENT_TOKENS",
            details: {
              required: MEAL_PLAN_TOKEN_COST,
              currentBalance: tokenValidation.currentBalance,
            },
          },
          { status: 402 }
        );
      }

      usedTokens = true;
    } else {
      // No tokens provided - check normal limit
      const limitCheck = await checkGenerateRecipeLimit(user.id);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: "Recipe generation limit reached",
            code: "LIMIT_EXCEEDED",
            details: {
              limit: limitCheck.limit,
              used: limitCheck.used,
              remaining: limitCheck.remaining,
              resetsAt: limitCheck.resetsAt,
              isLifetime: limitCheck.resetsAt === null,
              tokenCost: MEAL_PLAN_TOKEN_COST,
            },
          },
          { status: 429 }
        );
      }
    }

    const client = getOpenAIClient();

    let systemPrompt: string;
    let userPrompt: string;

    if (payload.existingRecipe) {
      // Refinement mode
      systemPrompt = `You are a professional chef refining recipes. 
Improve the following recipe while maintaining its core identity.
Make ingredients more precise, improve instructions, add missing steps, and enhance the overall quality.

Return a JSON recipe with the following structure:
{
  "title": "Recipe Title",
  "description": "Brief description",
  "servings": 4,
  "totalMinutes": 45,
  "tags": ["tag1", "tag2"],
  "ingredients": [
    {
      "name": "ingredient name",
      "qty": 2,
      "unit": "cup",
      "notes": "optional preparation notes"
    }
  ],
  "steps": [
    {
      "order": 1,
      "text": "Step instruction"
    }
  ]
}`;

      userPrompt = `Refine this recipe:\n${JSON.stringify(
        payload.existingRecipe,
        null,
        2
      )}`;
    } else {
      // New recipe generation mode - try hybrid search first
      const prefs = payload.preferences || {};

      // Try to find a matching recipe in the database first
      try {
        const candidates = await searchRecipeByQuery(payload.prompt!, {
          limit: 3,
          minSimilarity: 0.75, // Higher threshold for single recipe match
        });

        // Filter by preferences
        let filtered = candidates.filter((recipe) => {
          if (
            prefs.maxMinutes &&
            recipe.totalMinutes &&
            recipe.totalMinutes > prefs.maxMinutes
          ) {
            return false;
          }
          if (prefs.allergies) {
            const ingredients = recipe.ingredients as Array<{ name: string }>;
            const hasAllergen = ingredients?.some((ing) =>
              prefs.allergies?.some((allergen) =>
                ing.name.toLowerCase().includes(allergen.toLowerCase())
              )
            );
            if (hasAllergen) return false;
          }
          return true;
        });

        if (filtered.length > 0) {
          // Found a suitable recipe in database
          console.log(
            `Found recipe from database: ${
              filtered[0].title
            } (similarity: ${filtered[0].similarity.toFixed(2)})`
          );

          // Track usage
          await trackAiUsage(user.id, AiEndpoint.GENERATE_RECIPE);

          // Return recipe fields at root level for mobile app compatibility
          const dbRecipe = filtered[0];

          // Map database source to mobile app expected values
          // Database stores "generated" but mobile expects "ai", "url", or "manual"
          const mappedSource =
            dbRecipe.source === "generated" ? "ai" : dbRecipe.source || "ai";

          return NextResponse.json({
            id: dbRecipe.id,
            title: dbRecipe.title,
            description: dbRecipe.description,
            imageUrl: dbRecipe.imageUrl,
            servings: dbRecipe.servings,
            totalMinutes: dbRecipe.totalMinutes,
            tags: dbRecipe.tags,
            ingredients: dbRecipe.ingredients,
            steps: dbRecipe.steps,
            source: mappedSource,
            createdAt: dbRecipe.createdAt,
            // Metadata
            recipeSource: "database",
            usedTokens,
            tokensUsed: usedTokens ? MEAL_PLAN_TOKEN_COST : 0,
            message: "Recipe found in database",
          });
        }
      } catch (error) {
        console.error("Error searching database for recipe:", error);
        // Continue with AI generation if search fails
      }

      // No match found, generate with AI
      console.log("No suitable recipe found in database, generating with AI");

      systemPrompt = `You are a professional chef creating personalized recipes. 
Generate a complete recipe based on the user's request and preferences.

${
  prefs.householdSize
    ? `User Preferences:
- Household: ${prefs.householdSize} people`
    : ""
}
${prefs.dietStyle ? `- Diet: ${prefs.dietStyle}` : ""}
${
  prefs.allergies && prefs.allergies.length > 0
    ? `- Allergies (MUST AVOID): ${prefs.allergies.join(", ")}`
    : ""
}
${
  prefs.exclusions && prefs.exclusions.length > 0
    ? `- Avoid: ${prefs.exclusions.join(", ")}`
    : ""
}
${
  prefs.goals && prefs.goals.length > 0
    ? `- Goals: ${prefs.goals.join(", ")}`
    : ""
}
${prefs.maxMinutes ? `- Max cooking time: ${prefs.maxMinutes} minutes` : ""}
${prefs.cookingSkillLevel ? `- Skill level: ${prefs.cookingSkillLevel}` : ""}

${
  prefs.cuisinePreferences && prefs.cuisinePreferences.length > 0
    ? `Cuisine Preferences:
${prefs.cuisinePreferences.map((c) => `- ${c.cuisine}: ${c.level}`).join("\n")}`
    : ""
}

Return a JSON recipe with the following structure:
{
  "title": "Recipe Title",
  "description": "Brief description",
  "servings": ${prefs.householdSize || 4},
  "totalMinutes": 45,
  "tags": ["tag1", "tag2"],
  "ingredients": [
    {
      "name": "ingredient name",
      "qty": 2,
      "unit": "cup",
      "notes": "optional preparation notes"
    }
  ],
  "steps": [
    {
      "order": 1,
      "text": "Step instruction"
    }
  ]
}

Make sure the recipe is practical, delicious, and matches all the user's preferences.`;

      userPrompt = payload.prompt!;
    }

    // Call OpenAI API
    const completion = await client.chat.completions.create({
      model: "gpt-4o", // Use gpt-4o for high-quality recipe generation
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "AI generation failed", details: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse the response
    let recipe;
    try {
      recipe = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json(
        { error: "AI generation failed", details: "Invalid JSON response" },
        { status: 500 }
      );
    }

    // Validate the recipe has required fields
    if (!recipe.title) {
      return NextResponse.json(
        { error: "AI generation failed", details: "Recipe missing title" },
        { status: 500 }
      );
    }

    if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) {
      return NextResponse.json(
        {
          error: "AI generation failed",
          details: "Recipe missing ingredients",
        },
        { status: 500 }
      );
    }

    // Set default servings if not specified
    if (!recipe.servings && payload.preferences?.householdSize) {
      recipe.servings = payload.preferences.householdSize;
    }

    // Track usage
    await trackAiUsage(user.id, AiEndpoint.GENERATE_RECIPE);

    // Return recipe fields at root level for mobile app compatibility
    return NextResponse.json({
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl || null,
      servings: recipe.servings,
      totalMinutes: recipe.totalMinutes,
      tags: recipe.tags,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      source: "ai", // Mobile app expects "ai", "url", or "manual"
      // Metadata
      recipeSource: "ai",
      usedTokens,
      tokensUsed: usedTokens ? MEAL_PLAN_TOKEN_COST : 0,
      message: usedTokens
        ? "Recipe generated with AI using tokens"
        : "Recipe generated with AI",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
