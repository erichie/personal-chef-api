import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getOpenAIClient } from "@/lib/ai-utils";
import { trackAiUsage, AiEndpoint } from "@/lib/ai-usage-utils";

// Request validation schema
const explainInstructionRequestSchema = z.object({
  instruction: z.string().min(1, "Instruction is required"),
  recipeTitle: z.string().min(1, "Recipe title is required"),
  recipeContext: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload = explainInstructionRequestSchema.parse(body);

    const client = getOpenAIClient();

    const systemPrompt = `You are a patient cooking instructor explaining techniques to home cooks.
Provide clear, detailed explanations that include:
- What the instruction means in practical terms
- Key techniques or tips
- What to look for (visual/sensory cues)
- Common mistakes to avoid
- Approximate timing if relevant

Keep explanations conversational, encouraging, and 2-3 paragraphs.`;

    const userPrompt = `Recipe: "${payload.recipeTitle}"
${payload.recipeContext ? `Context: ${payload.recipeContext}\n` : ""}
Instruction: "${payload.instruction}"

Explain this instruction in detail.`;

    // Call OpenAI API
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // Cheaper model is fine for explanations
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    const explanation = completion.choices[0]?.message?.content;
    if (!explanation) {
      return NextResponse.json(
        { error: "AI generation failed", details: "No response from AI" },
        { status: 500 }
      );
    }

    // Validate explanation is not too short
    if (explanation.trim().length < 50) {
      return NextResponse.json(
        {
          error: "AI generation failed",
          details: "Explanation too short",
        },
        { status: 500 }
      );
    }

    // Track usage
    await trackAiUsage(user.id, AiEndpoint.EXPLAIN_INSTRUCTION);

    return NextResponse.json({ explanation: explanation.trim() });
  } catch (error) {
    return handleApiError(error);
  }
}
