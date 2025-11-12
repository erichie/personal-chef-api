import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getOpenAIClient } from "@/lib/ai-utils";
import {
  trackAiUsage,
  AiEndpoint,
  checkChatLimit,
  MEAL_PLAN_TOKEN_COST,
} from "@/lib/ai-usage-utils";

// Disable response caching and buffering for streaming
export const dynamic = "force-dynamic";

// Request validation schema
const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1, "At least one message is required"),
  context: z.string(),
  systemPrompt: z.string(),
  tokensToUse: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload = chatRequestSchema.parse(body);

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
      const limitCheck = await checkChatLimit(user.id);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: "Chat limit reached",
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

    // Build full system prompt with context
    const fullSystemPrompt = `${payload.systemPrompt}\n\n**Context:**\n${payload.context}`;

    // Prepare messages for OpenAI
    const messages = [
      { role: "system" as const, content: fullSystemPrompt },
      ...payload.messages,
    ];

    // Call OpenAI with streaming
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 200,
      temperature: 0.8,
      stream: true,
    });

    // Convert OpenAI stream to Web ReadableStream
    const encoder = new TextEncoder();
    let hasTrackedUsage = false;
    
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Track usage as first action in stream
          if (!hasTrackedUsage) {
            await trackAiUsage(user.id, AiEndpoint.CHAT);
            hasTrackedUsage = true;
          }

          for await (const part of response) {
            const text = part.choices[0]?.delta?.content;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    // Return streaming response with minimal headers
    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

