import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";

/**
 * POST /api/auth/guest
 * Create an anonymous user session using better-auth's anonymous plugin
 * This endpoint is a simple proxy to better-auth's anonymous sign-in
 */
export async function POST(request: NextRequest) {
  try {
    // Use better-auth's anonymous sign-in
    const result = await auth.api.signInAnonymous({
      headers: request.headers,
    });

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
