import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getOpenAIClient } from "@/lib/ai-utils";
import { prisma } from "@/lib/prisma";

// Request validation schema
const generateStepsRequestSchema = z.object({
  // Option 1: Provide recipe ID
  recipeId: z.string().optional(),

  // Option 2: Provide full recipe details
  recipe: z
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
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Verify authentication (user credentials validated but not directly used)
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload = generateStepsRequestSchema.parse(body);

    // Validate that either recipeId or recipe is provided
    if (!payload.recipeId && !payload.recipe) {
      return NextResponse.json(
        { error: "Either recipeId or recipe must be provided" },
        { status: 400 }
      );
    }

    let recipeData;

    // Fetch recipe from database if ID is provided
    if (payload.recipeId) {
      const dbRecipe = await prisma.recipe.findUnique({
        where: { id: payload.recipeId },
      });

      if (!dbRecipe) {
        return NextResponse.json(
          { error: "Recipe not found" },
          { status: 404 }
        );
      }

      if (dbRecipe.userId !== user.id) {
        return NextResponse.json(
          { error: "Recipe does not belong to this user" },
          { status: 403 }
        );
      }

      recipeData = {
        title: dbRecipe.title,
        description: dbRecipe.description || undefined,
        servings: dbRecipe.servings || undefined,
        totalMinutes: dbRecipe.totalMinutes || undefined,
        ingredients: dbRecipe.ingredients as any[],
      };
    } else {
      recipeData = payload.recipe!;
    }

    // Validate ingredients exist
    if (!recipeData.ingredients || recipeData.ingredients.length === 0) {
      return NextResponse.json(
        { error: "Recipe must have at least one ingredient" },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    const systemPrompt = `You are a professional chef creating detailed, easy-to-follow cooking instructions.

Generate clear, step-by-step cooking instructions for the recipe provided. Each step should:
- Be specific and actionable
- Include timing where relevant (e.g., "Cook for 5 minutes")
- Include visual/sensory cues (e.g., "until golden brown", "until fragrant")
- Be numbered in logical cooking order
- Be clear enough for a home cook to follow

Return the steps as a JSON array with this structure:
{
  "steps": [
    {
      "order": 1,
      "text": "Detailed instruction for step 1"
    },
    {
      "order": 2,
      "text": "Detailed instruction for step 2"
    }
  ]
}

Make the instructions practical, encouraging, and appropriate for the cooking skill level implied by the recipe complexity.`;

    // Format ingredients for the prompt
    const ingredientsList = recipeData.ingredients
      .map((ing) => {
        const qty = ing.qty ? `${ing.qty} ` : "";
        const unit = ing.unit ? `${ing.unit} ` : "";
        const notes = ing.notes ? ` (${ing.notes})` : "";
        return `- ${qty}${unit}${ing.name}${notes}`;
      })
      .join("\n");

    const userPrompt = `Generate detailed cooking steps for this recipe:

Recipe: "${recipeData.title}"
${recipeData.description ? `Description: ${recipeData.description}\n` : ""}
${recipeData.servings ? `Servings: ${recipeData.servings}\n` : ""}
${
  recipeData.totalMinutes
    ? `Total Time: ${recipeData.totalMinutes} minutes\n`
    : ""
}

Ingredients:
${ingredientsList}

Please generate clear, step-by-step cooking instructions.`;

    // Call OpenAI API
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // Use mini for cost efficiency
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "AI generation failed", details: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse the response
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json(
        { error: "AI generation failed", details: "Invalid JSON response" },
        { status: 500 }
      );
    }

    // Validate the steps exist
    if (!result.steps || !Array.isArray(result.steps)) {
      return NextResponse.json(
        { error: "AI generation failed", details: "No steps generated" },
        { status: 500 }
      );
    }

    console.log(`✅ Generated ${result.steps.length} cooking steps`);

    // If recipeId was provided, automatically save the steps to the database
    let recipeId = payload.recipeId;
    if (recipeId) {
      await prisma.recipe.update({
        where: { id: recipeId },
        data: {
          steps: result.steps as any,
        },
      });
      console.log(`💾 Saved steps to recipe ${recipeId} in database`);
    }

    return NextResponse.json({
      steps: result.steps,
      recipeId: recipeId || null,
      saved: !!recipeId,
      message: recipeId
        ? "Cooking steps generated and saved to recipe"
        : "Cooking steps generated successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
