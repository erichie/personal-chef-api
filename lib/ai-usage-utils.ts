import { prisma } from "./prisma";

/**
 * Constants for AI usage limits
 */
export const MEAL_PLAN_LIMIT = 8; // Meal plans allowed per 30-day rolling window
export const USAGE_WINDOW_DAYS = 30; // Rolling window for usage tracking
export const MEAL_PLAN_TOKEN_COST = 25; // Tokens required to bypass limit

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
 * Check if user can generate a meal plan (within limit)
 */
export async function checkMealPlanLimit(
  userId: string
): Promise<UsageLimitCheck> {
  const windowStart = getWindowStartDate();

  // Get usage in the current window
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
  const remaining = Math.max(0, MEAL_PLAN_LIMIT - used);
  const allowed = used < MEAL_PLAN_LIMIT;

  // Calculate when the oldest usage will expire (reset date)
  let resetsAt: Date | null = null;
  if (usages.length > 0 && !allowed) {
    // If at limit, the reset is when the oldest usage expires
    const oldestUsage = usages[0].createdAt;
    resetsAt = new Date(oldestUsage);
    resetsAt.setDate(resetsAt.getDate() + USAGE_WINDOW_DAYS);
  } else if (usages.length > 0) {
    // If not at limit, but have usages, show when the oldest will expire
    const oldestUsage = usages[0].createdAt;
    resetsAt = new Date(oldestUsage);
    resetsAt.setDate(resetsAt.getDate() + USAGE_WINDOW_DAYS);
  }

  return {
    allowed,
    limit: MEAL_PLAN_LIMIT,
    used,
    remaining,
    resetsAt,
  };
}

/**
 * Get AI usage statistics across all endpoints for a user
 * Useful for analytics and future limit enforcement
 */
export async function getAiUsageStats(userId: string): Promise<{
  mealPlan: {
    count: number;
    limit: number;
    remaining: number;
    resetsAt: Date | null;
  };
  allEndpoints: {
    [key: string]: number;
  };
}> {
  const windowStart = getWindowStartDate();

  // Get meal plan specific stats
  const mealPlanCheck = await checkMealPlanLimit(userId);

  // Get usage counts for all endpoints
  const allUsages = await prisma.aiUsage.findMany({
    where: {
      userId,
      createdAt: {
        gte: windowStart,
      },
    },
    select: {
      endpoint: true,
    },
  });

  // Count by endpoint
  const allEndpoints: { [key: string]: number } = {};
  allUsages.forEach((usage) => {
    allEndpoints[usage.endpoint] = (allEndpoints[usage.endpoint] || 0) + 1;
  });

  return {
    mealPlan: {
      count: mealPlanCheck.used,
      limit: mealPlanCheck.limit,
      remaining: mealPlanCheck.remaining,
      resetsAt: mealPlanCheck.resetsAt,
    },
    allEndpoints,
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
