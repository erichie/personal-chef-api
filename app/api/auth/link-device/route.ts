import { NextRequest, NextResponse } from "next/server";
import { handleApiError, errors } from "@/lib/api-errors";

/**
 * POST /api/auth/link-device
 *
 * DEPRECATED: This endpoint is no longer needed.
 *
 * With better-auth's anonymous plugin, linking happens automatically when
 * an anonymous user signs up or signs in with email/password or OAuth.
 * The onLinkAccount callback in lib/auth.ts handles all data migration.
 *
 * For account switching on the same device, users should:
 * 1. Sign out of current account
 * 2. Sign in with a different account
 */
export async function POST(request: NextRequest) {
  try {
    throw errors.badRequest(
      "This endpoint is deprecated. Anonymous users are automatically linked when signing up or signing in. " +
        "For account switching, please sign out and sign in with a different account."
    );
  } catch (error) {
    return handleApiError(error);
  }
}
