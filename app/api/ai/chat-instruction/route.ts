import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getOpenAIClient } from "@/lib/ai-utils";
import {
  trackAiUsage,
  AiEndpoint,
  checkChatInstructionLimit,
  validateUserTokens,
  MEAL_PLAN_TOKEN_COST,
} from "@/lib/ai-usage-utils";

// Request validation schema
const chatInstructionRequestSchema = z.object({
  // Conversation context (stays the same)
  context: z.object({
    instruction: z.string().min(1, "Instruction is required"),
    recipeTitle: z.string().min(1, "Recipe title is required"),
    recipeContext: z.string().optional(),
  }),

  // Message history (grows with each turn)
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1, "At least one message is required"),
  tokensToUse: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload = chatInstructionRequestSchema.parse(body);

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
      const limitCheck = await checkChatInstructionLimit(user.id);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: "Chat instruction limit reached",
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

    const systemPrompt = `You are a helpful cooking assistant chatting with someone while they cook.

Recipe: "${payload.context.recipeTitle}"
${
  payload.context.recipeContext
    ? `Description: ${payload.context.recipeContext}`
    : ""
}
Current Step: "${payload.context.instruction}"

Answer questions clearly and concisely. Be encouraging and practical. 
If they're asking about substitutions, timing, or techniques, provide specific advice.`;

    // Limit message history to last 10 messages to prevent token overflow
    const recentMessages = payload.messages.slice(-10);

    // Build the full message array
    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...recentMessages,
    ];

    // Call OpenAI API
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: apiMessages,
      max_tokens: 300,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return NextResponse.json(
        { error: "AI generation failed", details: "No response from AI" },
        { status: 500 }
      );
    }

    // Track usage
    await trackAiUsage(user.id, AiEndpoint.CHAT_INSTRUCTION);

    return NextResponse.json({
      response: response.trim(),
      usedTokens,
      tokensUsed: usedTokens ? MEAL_PLAN_TOKEN_COST : 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
