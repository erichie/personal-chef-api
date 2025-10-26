import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getOpenAIClient } from "@/lib/ai-utils";

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
          qty: z.union([z.number(), z.string()]).optional(),
          unit: z.string().optional(),
          notes: z.string().optional(),
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
});

export async function POST(request: NextRequest) {
  try {
    // Verify authentication (user credentials validated but not directly used)
    await requireAuth(request);

    const body = await request.json();
    const payload = generateRecipeRequestSchema.parse(body);

    // Validate that either prompt or existingRecipe is provided
    if (!payload.prompt && !payload.existingRecipe) {
      return NextResponse.json(
        { error: "Either prompt or existingRecipe must be provided" },
        { status: 400 }
      );
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
      // New recipe generation mode
      const prefs = payload.preferences || {};

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

    return NextResponse.json({ recipe });
  } catch (error) {
    return handleApiError(error);
  }
}
