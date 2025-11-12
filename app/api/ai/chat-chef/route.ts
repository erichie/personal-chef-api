import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getOpenAIClient } from "@/lib/ai-utils";
import {
  trackAiUsage,
  AiEndpoint,
  checkChatChefLimit,
  MEAL_PLAN_TOKEN_COST,
} from "@/lib/ai-usage-utils";

// Request validation schema
const chatChefRequestSchema = z.object({
  context: z
    .object({
      groceryList: z.array(z.any()).optional(),
      inventory: z.array(z.any()).optional(),
      mealPlan: z.any().optional(),
      preferences: z.any().optional(),
    })
    .optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
  tokensToUse: z.number().optional(),
});

/**
 * Build system prompt for chef chat with user context
 */
function buildChefSystemPrompt(context?: {
  groceryList?: any[];
  inventory?: any[];
  mealPlan?: any;
  preferences?: any;
}): string {
  let prompt = `You are a helpful personal chef assistant. Your role is to provide cooking advice, answer questions about recipes, suggest meal ideas, and help users with their meal planning and cooking needs.

When helping users:
- Be friendly, encouraging, and enthusiastic about cooking
- Provide practical, actionable advice
- Consider their dietary restrictions and preferences
- Keep responses concise but informative
- If they ask about specific recipes or ingredients, be specific and detailed
- If they need substitutions, provide creative alternatives
- Help them make the most of what they have available`;

  // Add context about their current state
  if (context) {
    if (context.inventory && context.inventory.length > 0) {
      const inventoryList = context.inventory
        .map((item: any) => item.name || item)
        .slice(0, 20) // Limit to avoid token overflow
        .join(", ");
      prompt += `\n\nUser's available inventory includes: ${inventoryList}${
        context.inventory.length > 20 ? ", and more" : ""
      }.`;
    }

    if (context.groceryList && context.groceryList.length > 0) {
      const groceryItems = context.groceryList
        .map((item: any) => item.name || item)
        .slice(0, 15)
        .join(", ");
      prompt += `\n\nUser's grocery list includes: ${groceryItems}${
        context.groceryList.length > 15 ? ", and more" : ""
      }.`;
    }

    if (context.mealPlan) {
      prompt += `\n\nUser has an active meal plan with ${
        context.mealPlan.days?.length || 0
      } days of meals.`;
    }

    if (context.preferences) {
      const prefs = context.preferences;
      if (prefs.dietStyle) {
        prompt += `\n\nUser's diet style: ${prefs.dietStyle}.`;
      }
      if (prefs.allergies && prefs.allergies.length > 0) {
        prompt += `\nUser has allergies to: ${prefs.allergies.join(", ")}.`;
      }
      if (prefs.exclusions && prefs.exclusions.length > 0) {
        prompt += `\nUser wants to avoid: ${prefs.exclusions.join(", ")}.`;
      }
    }
  }

  prompt += `\n\nProvide helpful, practical advice. Keep responses focused and actionable.`;

  return prompt;
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload = chatChefRequestSchema.parse(body);

    let usedTokens = false;

    // If tokens are provided, validate the amount (tokens are stored on device)
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

      // Token balance is managed on device, so we trust the mobile app
      usedTokens = true;
    } else {
      // No tokens provided - check normal limit
      const limitCheck = await checkChatChefLimit(user.id);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: "Chat chef limit reached",
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

    // Build system prompt with context
    const systemPrompt = buildChefSystemPrompt(payload.context);

    // Prepare messages for OpenAI
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...payload.messages,
    ];

    // Call OpenAI
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500, // Keep responses concise
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return NextResponse.json(
        { error: "Failed to generate response" },
        { status: 500 }
      );
    }

    // Track usage
    await trackAiUsage(user.id, AiEndpoint.CHAT_CHEF);

    return NextResponse.json({
      response,
      usedTokens,
      tokensUsed: usedTokens ? MEAL_PLAN_TOKEN_COST : 0,
      message: usedTokens
        ? "Response generated successfully using tokens"
        : "Response generated successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
