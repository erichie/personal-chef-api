import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getOpenAIClient } from "@/lib/ai-utils";
import { trackAiUsage, AiEndpoint } from "@/lib/ai-usage-utils";

// Request validation schema
const parsePantryRequestSchema = z.object({
  transcript: z.string().min(1, "Transcript is required"),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload = parsePantryRequestSchema.parse(body);

    // Handle empty/invalid transcripts
    if (!payload.transcript || payload.transcript.trim().length < 3) {
      return NextResponse.json({ items: [] });
    }

    const client = getOpenAIClient();

    const systemPrompt = `You are a grocery list parser. Extract items from natural language text.

Return a JSON object with an "items" array. Each item should have:
- name: item name (lowercase, singular form preferred)
- quantity: numeric amount
- unit: measurement unit (lb, oz, cup, piece, can, bag, etc.)
- category (optional): "produce", "meat", "dairy", "pantry", etc.

If quantity is ambiguous, default to 1.
If unit is ambiguous, use "item" or "piece".

Example input: "two pounds chicken, three onions, a dozen eggs"
Example output: 
{
  "items": [
    {"name": "chicken", "quantity": 2, "unit": "lb", "category": "meat"},
    {"name": "onion", "quantity": 3, "unit": "piece", "category": "produce"},
    {"name": "eggs", "quantity": 12, "unit": "piece", "category": "dairy"}
  ]
}`;

    const userPrompt = payload.transcript;

    // Call OpenAI API
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent parsing
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "AI generation failed", details: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse the response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error("Failed to parse AI response:", content);
      // Return empty array rather than error
      return NextResponse.json({ items: [] });
    }

    // Validate and normalize items
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    // Ensure all items have required fields and normalize quantities
    const normalizedItems = items
      .filter((item: any) => item.name && item.quantity && item.unit)
      .map((item: any) => ({
        name: item.name,
        quantity:
          typeof item.quantity === "string"
            ? parseFloat(item.quantity) || 1
            : item.quantity,
        unit: item.unit,
        ...(item.category && { category: item.category }),
      }))
      .filter((item: any) => item.quantity > 0);

    // Track usage
    await trackAiUsage(user.id, AiEndpoint.PARSE_PANTRY);

    return NextResponse.json({ items: normalizedItems });
  } catch (error) {
    return handleApiError(error);
  }
}
