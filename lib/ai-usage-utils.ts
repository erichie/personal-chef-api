import { prisma } from "./prisma";

/**
 * Constants for AI usage limits
 */
// Free user limits (lifetime)
export const FREE_MEAL_PLAN_LIMIT = 3;
export const FREE_ENDPOINT_LIMIT = 3; // Per endpoint

// Pro user limits
export const PRO_MEAL_PLAN_LIMIT = 10; // Per 30-day rolling window
export const PRO_ENDPOINT_LIMIT = Infinity; // Unlimited (but easy to change)

// Token costs
export const MEAL_PLAN_TOKEN_COST = 25; // Tokens required to bypass limit
export const USAGE_WINDOW_DAYS = 30; // Rolling window for pro users only

/**
 * AI endpoint identifiers
 */
export enum AiEndpoint {
  MEAL_PLAN = "meal-plan",
  GENERATE_RECIPE = "generate-recipe",
  REPLACE_RECIPE = "replace-recipe",
  PARSE_RECIPE = "parse-recipe",
  GENERATE_STEPS = "generate-steps",
  PARSE_PANTRY = "parse-pantry",
  CHAT_INSTRUCTION = "chat-instruction",
  EXPLAIN_INSTRUCTION = "explain-instruction",
}

/**
 * Result of checking if user can use an endpoint
 */
export interface UsageLimitCheck {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  resetsAt: Date | null; // When the oldest usage will expire
}

/**
 * Track AI endpoint usage
 */
export async function trackAiUsage(
  userId: string,
  endpoint: AiEndpoint | string
): Promise<void> {
  try {
    await prisma.aiUsage.create({
      data: {
        userId,
        endpoint,
      },
    });
    console.log(`Tracked AI usage: ${endpoint} for user ${userId}`);
  } catch (error) {
    console.error("Error tracking AI usage:", error);
    // Don't throw - tracking failure shouldn't break the request
  }
}

/**
 * Get the date for the start of the rolling window
 */
function getWindowStartDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() - USAGE_WINDOW_DAYS);
  return date;
}

/**
 * Get meal plan usage count for a user in the rolling window
 */
export async function getMealPlanUsage(userId: string): Promise<number> {
  const windowStart = getWindowStartDate();

  const count = await prisma.aiUsage.count({
    where: {
      userId,
      endpoint: AiEndpoint.MEAL_PLAN,
      createdAt: {
        gte: windowStart,
      },
    },
  });

  return count;
}

/**
 * Generic function to check endpoint limit based on user type
 */
export async function checkEndpointLimit(
  userId: string,
  endpoint: AiEndpoint
): Promise<UsageLimitCheck> {
  // Fetch user's pro status
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPro: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const isPro = user.isPro;

  // Pro users: unlimited for everything except meal plans
  if (isPro && endpoint !== AiEndpoint.MEAL_PLAN) {
    return {
      allowed: true,
      limit: Infinity,
      used: 0,
      remaining: Infinity,
      resetsAt: null,
    };
  }

  // Pro users for meal plans: 10 per 30 days
  if (isPro && endpoint === AiEndpoint.MEAL_PLAN) {
    const windowStart = getWindowStartDate();

    const usages = await prisma.aiUsage.findMany({
      where: {
        userId,
        endpoint: AiEndpoint.MEAL_PLAN,
        createdAt: {
          gte: windowStart,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        createdAt: true,
      },
    });

    const used = usages.length;
    const limit = PRO_MEAL_PLAN_LIMIT;
    const remaining = Math.max(0, limit - used);
    const allowed = used < limit;

    // Calculate reset date (when oldest usage expires)
    let resetsAt: Date | null = null;
    if (usages.length > 0) {
      const oldestUsage = usages[0].createdAt;
      resetsAt = new Date(oldestUsage);
      resetsAt.setDate(resetsAt.getDate() + USAGE_WINDOW_DAYS);
    }

    return {
      allowed,
      limit,
      used,
      remaining,
      resetsAt,
    };
  }

  // Free users: lifetime limit of 3 for all endpoints
  const lifetimeUsages = await prisma.aiUsage.findMany({
    where: {
      userId,
      endpoint,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      createdAt: true,
    },
  });

  const used = lifetimeUsages.length;
  const limit = FREE_ENDPOINT_LIMIT;
  const remaining = Math.max(0, limit - used);
  const allowed = used < limit;

  return {
    allowed,
    limit,
    used,
    remaining,
    resetsAt: null, // Lifetime limits never reset
  };
}

/**
 * Check if user can generate a meal plan (within limit)
 */
export async function checkMealPlanLimit(
  userId: string
): Promise<UsageLimitCheck> {
  return checkEndpointLimit(userId, AiEndpoint.MEAL_PLAN);
}

/**
 * Check if user can generate a recipe (within limit)
 */
export async function checkGenerateRecipeLimit(
  userId: string
): Promise<UsageLimitCheck> {
  return checkEndpointLimit(userId, AiEndpoint.GENERATE_RECIPE);
}

/**
 * Check if user can replace a recipe (within limit)
 */
export async function checkReplaceRecipeLimit(
  userId: string
): Promise<UsageLimitCheck> {
  return checkEndpointLimit(userId, AiEndpoint.REPLACE_RECIPE);
}

/**
 * Check if user can parse a recipe (within limit)
 */
export async function checkParseRecipeLimit(
  userId: string
): Promise<UsageLimitCheck> {
  return checkEndpointLimit(userId, AiEndpoint.PARSE_RECIPE);
}

/**
 * Check if user can generate steps (within limit)
 */
export async function checkGenerateStepsLimit(
  userId: string
): Promise<UsageLimitCheck> {
  return checkEndpointLimit(userId, AiEndpoint.GENERATE_STEPS);
}

/**
 * Check if user can parse pantry (within limit)
 */
export async function checkParsePantryLimit(
  userId: string
): Promise<UsageLimitCheck> {
  return checkEndpointLimit(userId, AiEndpoint.PARSE_PANTRY);
}

/**
 * Check if user can use chat instruction (within limit)
 */
export async function checkChatInstructionLimit(
  userId: string
): Promise<UsageLimitCheck> {
  return checkEndpointLimit(userId, AiEndpoint.CHAT_INSTRUCTION);
}

/**
 * Check if user can use explain instruction (within limit)
 */
export async function checkExplainInstructionLimit(
  userId: string
): Promise<UsageLimitCheck> {
  return checkEndpointLimit(userId, AiEndpoint.EXPLAIN_INSTRUCTION);
}

/**
 * Get AI usage statistics across all endpoints for a user
 * Returns comprehensive limit info based on user type (free/pro)
 */
export async function getAiUsageStats(userId: string): Promise<{
  mealPlan: UsageLimitCheck & { tokenCost: number };
  generateRecipe: UsageLimitCheck & { tokenCost: number };
  replaceRecipe: UsageLimitCheck & { tokenCost: number };
  parseRecipe: UsageLimitCheck & { tokenCost: number };
  generateSteps: UsageLimitCheck & { tokenCost: number };
  parsePantry: UsageLimitCheck & { tokenCost: number };
  chatInstruction: UsageLimitCheck & { tokenCost: number };
  explainInstruction: UsageLimitCheck & { tokenCost: number };
}> {
  // Get limits for all endpoints
  const [
    mealPlanLimit,
    generateRecipeLimit,
    replaceRecipeLimit,
    parseRecipeLimit,
    generateStepsLimit,
    parsePantryLimit,
    chatInstructionLimit,
    explainInstructionLimit,
  ] = await Promise.all([
    checkMealPlanLimit(userId),
    checkGenerateRecipeLimit(userId),
    checkReplaceRecipeLimit(userId),
    checkParseRecipeLimit(userId),
    checkGenerateStepsLimit(userId),
    checkParsePantryLimit(userId),
    checkChatInstructionLimit(userId),
    checkExplainInstructionLimit(userId),
  ]);

  return {
    mealPlan: { ...mealPlanLimit, tokenCost: MEAL_PLAN_TOKEN_COST },
    generateRecipe: { ...generateRecipeLimit, tokenCost: MEAL_PLAN_TOKEN_COST },
    replaceRecipe: { ...replaceRecipeLimit, tokenCost: MEAL_PLAN_TOKEN_COST },
    parseRecipe: { ...parseRecipeLimit, tokenCost: MEAL_PLAN_TOKEN_COST },
    generateSteps: { ...generateStepsLimit, tokenCost: MEAL_PLAN_TOKEN_COST },
    parsePantry: { ...parsePantryLimit, tokenCost: MEAL_PLAN_TOKEN_COST },
    chatInstruction: {
      ...chatInstructionLimit,
      tokenCost: MEAL_PLAN_TOKEN_COST,
    },
    explainInstruction: {
      ...explainInstructionLimit,
      tokenCost: MEAL_PLAN_TOKEN_COST,
    },
  };
}

/**
 * Token state structure from mobile app
 */
interface TokenState {
  balance: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    timestamp: string;
    description: string;
    relatedId?: string;
  }>;
  lifetimeSpent: number;
  lifetimeEarned: number;
}

/**
 * Validate that a user has enough tokens to bypass a limit
 * Does NOT deduct tokens - mobile app handles that after success
 */
export async function validateUserTokens(
  userId: string,
  tokensRequired: number
): Promise<{ valid: boolean; currentBalance: number; error?: string }> {
  try {
    // Fetch user's token state from profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { tokenState: true },
    });

    if (!userProfile) {
      return {
        valid: false,
        currentBalance: 0,
        error: "User profile not found",
      };
    }

    // Parse token state
    let tokenState: TokenState;
    try {
      tokenState = JSON.parse(userProfile.tokenState as string) as TokenState;
    } catch (error) {
      console.error("Failed to parse tokenState:", error);
      return {
        valid: false,
        currentBalance: 0,
        error: "Invalid token state format",
      };
    }

    // Validate balance
    const balance = tokenState.balance || 0;
    const valid = balance >= tokensRequired;

    return {
      valid,
      currentBalance: balance,
      error: valid ? undefined : "Insufficient tokens",
    };
  } catch (error) {
    console.error("Error validating user tokens:", error);
    return {
      valid: false,
      currentBalance: 0,
      error: "Failed to validate tokens",
    };
  }
}
