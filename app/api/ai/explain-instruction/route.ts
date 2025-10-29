import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getOpenAIClient } from "@/lib/ai-utils";
import {
  trackAiUsage,
  AiEndpoint,
  checkExplainInstructionLimit,
  validateUserTokens,
  MEAL_PLAN_TOKEN_COST,
} from "@/lib/ai-usage-utils";

// Request validation schema
const explainInstructionRequestSchema = z.object({
  instruction: z.string().min(1, "Instruction is required"),
  recipeTitle: z.string().min(1, "Recipe title is required"),
  recipeContext: z.string().optional(),
  tokensToUse: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload = explainInstructionRequestSchema.parse(body);

    let usedTokens = false;

    // If tokens are provided, validate them instead of checking limit
    if (payload.tokensToUse !== undefined) {
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
      const limitCheck = await checkExplainInstructionLimit(user.id);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: "Instruction explanation limit reached",
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

    return NextResponse.json({
      explanation: explanation.trim(),
      usedTokens,
      tokensUsed: usedTokens ? MEAL_PLAN_TOKEN_COST : 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
