import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getOpenAIClient } from "@/lib/ai-utils";
import {
  trackAiUsage,
  AiEndpoint,
  checkParseOnboardingResponseLimit,
  MEAL_PLAN_TOKEN_COST,
} from "@/lib/ai-usage-utils";

// Onboarding phase enum
const onboardingPhaseSchema = z.enum([
  "ASK_NAME",
  "SHOW_RECIPES",
  "RECIPE_SWIPE",
  "ASK_ALLERGIES",
  "ASK_DIET",
  "ASK_HOUSEHOLD",
  "ASK_COOKING_FREQUENCY",
  "ASK_TIME_AND_SKILL",
  "MEAL_PLAN_CONFIRM",
  "COMPLETE",
]);

type OnboardingPhase = z.infer<typeof onboardingPhaseSchema>;

// Request validation schema
const parseOnboardingRequestSchema = z.object({
  userMessage: z.string().min(1, "User message is required"),
  currentPhase: onboardingPhaseSchema,
  conversationContext: z
    .object({
      previousMessages: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        )
        .optional(),
      ingredientPreferences: z
        .object({
          clarifyWithUser: z
            .array(
              z.object({
                name: z.string(),
                count: z.number(),
                reason: z.string(),
              })
            )
            .optional(),
          topDislikes: z
            .array(
              z.object({
                name: z.string(),
                count: z.number(),
              })
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
  tokensToUse: z.number().optional(),
});

// Parsed response interface
interface ParsedOnboardingResponse {
  userName?: string;
  allergies?: string[];
  dislikes?: string[];
  restrictions?: Array<{
    ingredient: string;
    reason?: string;
  }>;
  dietStyle?: string;
  householdSize?: number;
  cookingDays?: number;
  cookingTimeMinutes?: number;
  skillLevel?: "beginner" | "intermediate" | "advanced";
}

/**
 * Build phase-specific parsing prompt
 */
function buildParsePrompt(
  userMessage: string,
  currentPhase: OnboardingPhase,
  context?: any
): string {
  const phaseInstructions: Record<OnboardingPhase, string> = {
    ASK_NAME: `Extract the user's first name from: "${userMessage}"

Instructions:
- Look for patterns like "I'm [name]", "My name is [name]", "[name]", "It's [name]"
- Return only the first name, properly capitalized
- If no clear name is found, return null

Return JSON: {"userName": "extracted name" or null}`,

    ASK_ALLERGIES: `Extract allergies and dislikes from: "${userMessage}"

Instructions:
- Allergies: life-threatening or serious reactions (use "allergies" array)
- Dislikes: preferences, not allergies (use "dislikes" array)
- Restrictions: dietary restrictions with optional reasons (use "restrictions" array)
- Handle "none", "no", "nothing" → return empty arrays
- Handle multiple items: "peanuts and shellfish" → ["peanuts", "shellfish"]
- Handle "or" conjunctions: "olives or mushrooms" → ["olives", "mushrooms"]

${
  context?.ingredientPreferences?.clarifyWithUser
    ? `\nContext: User previously disliked these ingredients: ${context.ingredientPreferences.clarifyWithUser.map((i: any) => i.name).join(", ")}`
    : ""
}

Return JSON: {"allergies": [...], "dislikes": [...], "restrictions": [...]}`,

    ASK_DIET: `Extract diet style from: "${userMessage}"

Instructions:
- Identify the diet type from the message
- Standard options: vegan, vegetarian, keto, paleo, mediterranean, gluten free, dairy free, low carb, balanced
- Handle variations and map to standard values
- "no diet", "nothing", "everything" → "balanced"
- If unclear, return null

Return JSON: {"dietStyle": "extracted style" or null}`,

    ASK_HOUSEHOLD: `Extract household size (number of people) from: "${userMessage}"

Instructions:
- Look for numbers: "2 people", "family of 4", "just me" (1)
- Handle word numbers: "two", "three", "couple" (2)
- Valid range: 1-20 people
- If unclear or out of range, return null

Return JSON: {"householdSize": number or null}`,

    ASK_COOKING_FREQUENCY: `Extract cooking frequency (days per week) from: "${userMessage}"

Instructions:
- Extract days per week: "5 times", "every night" (7), "3 days"
- Handle phrases: "every night" → 7, "most nights" → 5, "few times" → 3
- Valid range: 1-7 days
- If unclear or out of range, return null

Return JSON: {"cookingDays": number or null}`,

    ASK_TIME_AND_SKILL: `Extract cooking time (in minutes) and skill level from: "${userMessage}"

Instructions:
- Time: Convert to minutes - "30 min" → 30, "1 hour" → 60, "45 minutes" → 45
- Time range: 1-240 minutes
- Skill: beginner, intermediate, or advanced
- Handle skill variations: "new to cooking" → "beginner", "expert" → "advanced"
- Extract both if present, return null for missing values

Return JSON: {"cookingTimeMinutes": number or null, "skillLevel": "beginner|intermediate|advanced" or null}`,

    SHOW_RECIPES: `No extraction needed for this phase.
Return JSON: {}`,

    RECIPE_SWIPE: `No extraction needed for this phase.
Return JSON: {}`,

    MEAL_PLAN_CONFIRM: `No extraction needed for this phase.
Return JSON: {}`,

    COMPLETE: `No extraction needed for this phase.
Return JSON: {}`,
  };

  return phaseInstructions[currentPhase];
}

/**
 * Validate and normalize parsed data
 */
function validateAndNormalize(
  parsed: any,
  phase: OnboardingPhase
): ParsedOnboardingResponse {
  const result: ParsedOnboardingResponse = {};

  // Name validation
  if (parsed.userName && typeof parsed.userName === "string") {
    const name = parsed.userName.trim();
    if (name.length > 0 && name.length <= 50) {
      // Capitalize first letter
      result.userName = name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  // Allergies validation
  if (parsed.allergies && Array.isArray(parsed.allergies)) {
    result.allergies = parsed.allergies
      .filter((a) => typeof a === "string" && a.trim().length > 0)
      .map((a) => a.trim().toLowerCase())
      .filter((a, index, self) => self.indexOf(a) === index); // Remove duplicates
  }

  // Dislikes validation
  if (parsed.dislikes && Array.isArray(parsed.dislikes)) {
    result.dislikes = parsed.dislikes
      .filter((d) => typeof d === "string" && d.trim().length > 0)
      .map((d) => d.trim().toLowerCase())
      .filter((d, index, self) => self.indexOf(d) === index); // Remove duplicates
  }

  // Restrictions validation
  if (parsed.restrictions && Array.isArray(parsed.restrictions)) {
    result.restrictions = parsed.restrictions
      .filter(
        (r) =>
          r &&
          typeof r === "object" &&
          typeof r.ingredient === "string" &&
          r.ingredient.trim().length > 0
      )
      .map((r) => ({
        ingredient: r.ingredient.trim().toLowerCase(),
        reason: r.reason && typeof r.reason === "string" ? r.reason.trim() : undefined,
      }));
  }

  // Diet style normalization
  if (parsed.dietStyle && typeof parsed.dietStyle === "string") {
    const normalized = parsed.dietStyle.trim().toLowerCase();
    
    // Map variations to standard values
    const dietMap: Record<string, string> = {
      veggie: "vegetarian",
      "plant-based": "vegan",
      "plant based": "vegan",
      wfpb: "vegan",
      "whole food plant based": "vegan",
      "no diet": "balanced",
      nothing: "balanced",
      everything: "balanced",
      normal: "balanced",
      omnivore: "balanced",
      ketogenic: "keto",
      "gluten-free": "gluten free",
      "dairy-free": "dairy free",
      "low-carb": "low carb",
    };

    result.dietStyle = dietMap[normalized] || normalized;
  }

  // Household size validation
  if (parsed.householdSize !== undefined && parsed.householdSize !== null) {
    const num = parseInt(String(parsed.householdSize));
    if (!isNaN(num) && num > 0 && num <= 20) {
      result.householdSize = num;
    }
  }

  // Cooking days validation
  if (parsed.cookingDays !== undefined && parsed.cookingDays !== null) {
    const num = parseInt(String(parsed.cookingDays));
    if (!isNaN(num) && num > 0 && num <= 7) {
      result.cookingDays = num;
    }
  }

  // Cooking time validation
  if (
    parsed.cookingTimeMinutes !== undefined &&
    parsed.cookingTimeMinutes !== null
  ) {
    const num = parseInt(String(parsed.cookingTimeMinutes));
    if (!isNaN(num) && num > 0 && num <= 240) {
      result.cookingTimeMinutes = num;
    }
  }

  // Skill level validation
  if (parsed.skillLevel && typeof parsed.skillLevel === "string") {
    const normalized = parsed.skillLevel.trim().toLowerCase();
    if (["beginner", "intermediate", "advanced"].includes(normalized)) {
      result.skillLevel = normalized as "beginner" | "intermediate" | "advanced";
    }
  }

  return result;
}

/**
 * Calculate confidence level based on parsed data
 */
function calculateConfidence(
  parsed: ParsedOnboardingResponse,
  phase: OnboardingPhase
): "high" | "medium" | "low" {
  // Phase-specific confidence calculation
  const phaseExpectations: Record<OnboardingPhase, (p: ParsedOnboardingResponse) => boolean> = {
    ASK_NAME: (p) => !!p.userName,
    ASK_ALLERGIES: (p) => !!(p.allergies || p.dislikes || p.restrictions),
    ASK_DIET: (p) => !!p.dietStyle,
    ASK_HOUSEHOLD: (p) => p.householdSize !== undefined,
    ASK_COOKING_FREQUENCY: (p) => p.cookingDays !== undefined,
    ASK_TIME_AND_SKILL: (p) =>
      p.cookingTimeMinutes !== undefined || p.skillLevel !== undefined,
    SHOW_RECIPES: () => true,
    RECIPE_SWIPE: () => true,
    MEAL_PLAN_CONFIRM: () => true,
    COMPLETE: () => true,
  };

  const hasExpectedData = phaseExpectations[phase]?.(parsed) ?? false;

  if (hasExpectedData) {
    // Check completeness for time and skill phase
    if (phase === "ASK_TIME_AND_SKILL") {
      const hasBoth = parsed.cookingTimeMinutes && parsed.skillLevel;
      const hasOne = parsed.cookingTimeMinutes || parsed.skillLevel;
      return hasBoth ? "high" : hasOne ? "medium" : "low";
    }
    return "high";
  }

  return "low";
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const body = await request.json();
    const payload = parseOnboardingRequestSchema.parse(body);

    let usedTokens = false;

    // If tokens are provided, validate the amount
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
      usedTokens = true;
    } else {
      // Check normal limit
      const limitCheck = await checkParseOnboardingResponseLimit(user.id);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: "Parse onboarding response limit reached",
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

    // Build parsing prompt
    const prompt = buildParsePrompt(
      payload.userMessage,
      payload.currentPhase,
      payload.conversationContext
    );

    // Call OpenAI for parsing
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a data extraction assistant. Extract structured data from user messages during onboarding.
Return ONLY valid JSON matching the requested schema. No explanations, no markdown code blocks, just raw JSON.
Be precise and conservative - if you're not confident about extracting data, return null for that field.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Very low for consistent extraction
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      // Return empty result on failure (frontend has fallback)
      return NextResponse.json({
        parsed: {},
        confidence: "low",
      });
    }

    // Parse and validate
    let rawParsed: any;
    try {
      rawParsed = JSON.parse(content);
    } catch (error) {
      console.error("[ParseOnboarding] Failed to parse JSON:", error);
      return NextResponse.json({
        parsed: {},
        confidence: "low",
      });
    }

    // Validate and normalize
    const parsed = validateAndNormalize(rawParsed, payload.currentPhase);
    const confidence = calculateConfidence(parsed, payload.currentPhase);

    // Track usage
    await trackAiUsage(user.id, AiEndpoint.PARSE_ONBOARDING_RESPONSE);

    return NextResponse.json({
      parsed,
      confidence,
    });
  } catch (error) {
    // For validation errors, return standard error
    if (error instanceof z.ZodError) {
      return handleApiError(error);
    }

    // For all other errors, return empty result (graceful fallback)
    console.error("[ParseOnboarding] Error:", error);
    return NextResponse.json({
      parsed: {},
      confidence: "low",
    });
  }
}

