import { prisma } from "./prisma";

/**
 * RevenueCat webhook event types
 */
export enum RevenueCatEventType {
  INITIAL_PURCHASE = "INITIAL_PURCHASE",
  RENEWAL = "RENEWAL",
  CANCELLATION = "CANCELLATION",
  UNCANCELLATION = "UNCANCELLATION",
  NON_RENEWING_PURCHASE = "NON_RENEWING_PURCHASE",
  EXPIRATION = "EXPIRATION",
  BILLING_ISSUE = "BILLING_ISSUE",
  PRODUCT_CHANGE = "PRODUCT_CHANGE",
  TRIAL_STARTED = "TRIAL_STARTED",
  TRIAL_CONVERTED = "TRIAL_CONVERTED",
  TRIAL_CANCELLED = "TRIAL_CANCELLED",
}

/**
 * RevenueCat webhook event payload structure
 */
export interface RevenueCatEvent {
  api_version: string;
  event: {
    id: string;
    type: RevenueCatEventType;
    app_user_id: string;
    aliases: string[];
    original_app_user_id: string;
    product_id: string;
    period_type: string;
    purchased_at_ms: number;
    expiration_at_ms?: number;
    environment: string;
    presented_offering_id?: string;
    transaction_id: string;
    original_transaction_id: string;
    is_family_share: boolean;
    country_code: string;
    currency: string;
    price: number;
    price_in_purchased_currency: number;
    subscriber_attributes: {
      [key: string]: {
        value: string;
        updated_at_ms: number;
      };
    };
    store: string;
    takehome_percentage: number;
  };
}

/**
 * Update user's pro status based on email
 */
export async function updateUserProStatus(
  email: string,
  isPro: boolean
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, isPro: true },
    });

    if (!user) {
      console.warn(`User not found for email: ${email}`);
      return {
        success: false,
        error: "User not found",
      };
    }

    // Only update if status is changing
    if (user.isPro !== isPro) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isPro },
      });

      console.log(
        `Updated user ${user.id} (${email}) pro status: ${user.isPro} -> ${isPro}`
      );
    } else {
      console.log(
        `User ${user.id} (${email}) already has isPro=${isPro}, skipping update`
      );
    }

    return {
      success: true,
      userId: user.id,
    };
  } catch (error) {
    console.error("Error updating user pro status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handle RevenueCat webhook event and update user accordingly
 */
export async function handleRevenueCatEvent(
  event: RevenueCatEvent
): Promise<{ success: boolean; message: string }> {
  const eventType = event.event.type;
  const email = event.event.subscriber_attributes.$email?.value;

  if (!email) {
    console.error("No email found in RevenueCat event", event);
    return {
      success: false,
      message: "No email attribute found in event",
    };
  }

  console.log(`Processing RevenueCat event: ${eventType} for email: ${email}`);

  let isPro: boolean | null = null;

  switch (eventType) {
    // Events that should set isPro = true
    case RevenueCatEventType.INITIAL_PURCHASE:
      isPro = true;
      console.log("New subscription started");
      break;

    case RevenueCatEventType.RENEWAL:
      isPro = true;
      console.log("Subscription renewed");
      break;

    case RevenueCatEventType.TRIAL_STARTED:
      isPro = true;
      console.log("Trial started");
      break;

    case RevenueCatEventType.TRIAL_CONVERTED:
      isPro = true;
      console.log("Trial converted to paid");
      break;

    case RevenueCatEventType.UNCANCELLATION:
      isPro = true;
      console.log("Subscription uncancelled");
      break;

    // Events that should set isPro = false
    case RevenueCatEventType.EXPIRATION:
      isPro = false;
      console.log("Subscription expired");
      break;

    case RevenueCatEventType.TRIAL_CANCELLED:
      isPro = false;
      console.log("Trial cancelled without conversion");
      break;

    // Events that might change status based on expiration
    case RevenueCatEventType.CANCELLATION:
      // Check if already expired
      const expirationMs = event.event.expiration_at_ms;
      if (expirationMs && expirationMs < Date.now()) {
        isPro = false;
        console.log("Subscription cancelled and already expired");
      } else {
        // Keep pro status until expiration
        console.log(
          "Subscription cancelled but not yet expired, keeping pro status"
        );
        return {
          success: true,
          message: "Subscription cancelled but still active until expiration",
        };
      }
      break;

    // Events that don't change pro status
    case RevenueCatEventType.BILLING_ISSUE:
      console.log(
        "Billing issue detected, keeping current status (grace period)"
      );
      return {
        success: true,
        message: "Billing issue - no status change during grace period",
      };

    case RevenueCatEventType.PRODUCT_CHANGE:
      console.log("Product changed (upgrade/downgrade), keeping pro status");
      return {
        success: true,
        message: "Product changed - maintaining pro status",
      };

    case RevenueCatEventType.NON_RENEWING_PURCHASE:
      // Could be handled differently based on business logic
      console.log("Non-renewing purchase, checking expiration");
      const nonRenewExpirationMs = event.event.expiration_at_ms;
      isPro = nonRenewExpirationMs ? nonRenewExpirationMs > Date.now() : true;
      break;

    default:
      console.warn(`Unknown RevenueCat event type: ${eventType}`);
      return {
        success: false,
        message: `Unknown event type: ${eventType}`,
      };
  }

  // Update user if we determined a new status
  if (isPro !== null) {
    const result = await updateUserProStatus(email, isPro);
    if (result.success) {
      return {
        success: true,
        message: `User ${result.userId} updated to isPro=${isPro}`,
      };
    } else {
      return {
        success: false,
        message: result.error || "Failed to update user",
      };
    }
  }

  return {
    success: true,
    message: "Event processed, no status change needed",
  };
}

/**
 * Verify RevenueCat webhook signature
 * @param signature The signature from the Authorization header
 * @param secret The webhook secret from environment variables
 * @returns true if signature is valid
 */
export function verifyRevenueCatSignature(
  signature: string,
  secret: string
): boolean {
  // RevenueCat uses the Authorization header with format: "Bearer {secret}"
  const expectedAuth = `Bearer ${secret}`;
  return signature === expectedAuth;
}
