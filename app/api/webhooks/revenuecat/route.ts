import { NextRequest, NextResponse } from "next/server";
import {
  handleRevenueCatEvent,
  verifyRevenueCatSignature,
  type RevenueCatEvent,
} from "@/lib/subscription-utils";

/**
 * POST /api/webhooks/revenuecat
 *
 * Receives webhook events from RevenueCat and updates user subscription status
 *
 * Security:
 * - Verifies webhook signature using Authorization header
 * - Checks for X-Revenuecat-Event header
 *
 * Supported Events:
 * - INITIAL_PURCHASE: New subscription → isPro = true
 * - RENEWAL: Subscription renewed → isPro = true
 * - TRIAL_STARTED: Trial started → isPro = true
 * - TRIAL_CONVERTED: Trial converted → isPro = true
 * - UNCANCELLATION: Subscription reactivated → isPro = true
 * - EXPIRATION: Subscription ended → isPro = false
 * - TRIAL_CANCELLED: Trial ended → isPro = false
 * - CANCELLATION: Subscription cancelled (keeps pro until expiration)
 * - BILLING_ISSUE: Grace period (no change)
 * - PRODUCT_CHANGE: Upgrade/downgrade (keeps pro)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const authHeader = request.headers.get("Authorization");
    const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("REVENUECAT_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    if (!authHeader) {
      console.warn("RevenueCat webhook received without Authorization header");
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    if (!verifyRevenueCatSignature(authHeader, webhookSecret)) {
      console.warn("RevenueCat webhook signature verification failed");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Check for event header
    const eventHeader = request.headers.get("X-Revenuecat-Event");
    if (!eventHeader) {
      console.warn("RevenueCat webhook missing X-Revenuecat-Event header");
      return NextResponse.json(
        { error: "Missing X-Revenuecat-Event header" },
        { status: 400 }
      );
    }

    // Parse webhook payload
    let event: RevenueCatEvent;
    try {
      event = await request.json();
    } catch (error) {
      console.error("Failed to parse RevenueCat webhook body:", error);
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Validate event structure
    if (!event.event || !event.event.type) {
      console.error("Invalid RevenueCat event structure:", event);
      return NextResponse.json(
        { error: "Invalid event structure" },
        { status: 400 }
      );
    }

    console.log(
      `Received RevenueCat webhook: ${event.event.type} (Event ID: ${event.event.id})`
    );
    console.log(`App User ID: ${event.event.app_user_id}`);
    console.log(`Product ID: ${event.event.product_id}`);
    console.log(`Environment: ${event.event.environment}`);

    // Handle the event
    const result = await handleRevenueCatEvent(event);

    if (result.success) {
      console.log(
        `RevenueCat webhook processed successfully: ${result.message}`
      );
      return NextResponse.json(
        {
          success: true,
          message: result.message,
        },
        { status: 200 }
      );
    } else {
      console.error(`RevenueCat webhook processing failed: ${result.message}`);
      // Return 200 anyway to acknowledge receipt
      // RevenueCat will retry if we return an error
      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error processing RevenueCat webhook:", error);

    // Return 200 to prevent retries for unexpected errors
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}

/**
 * GET /api/webhooks/revenuecat
 *
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "RevenueCat webhook endpoint is active",
    webhookConfigured: !!process.env.REVENUECAT_WEBHOOK_SECRET,
  });
}
