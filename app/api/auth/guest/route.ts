import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { generateFriendCode } from "@/lib/friend-code-generator";

/**
 * POST /api/auth/guest
 * Create an anonymous user session using better-auth's anonymous plugin
 */
export async function POST(request: NextRequest) {
  try {
    // Use better-auth's anonymous sign-in
    const result = await auth.api.signInAnonymous({
      headers: request.headers,
    });

    // Generate friend code for the new anonymous user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (result as any).user?.id;

    if (userId) {
      // Check if user already has a friend code
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { friendCode: true },
      });

      if (!user?.friendCode) {
        // Generate unique friend code
        const maxAttempts = 10;
        let friendCode: string | null = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const code = generateFriendCode();
          const existing = await prisma.user.findUnique({
            where: { friendCode: code },
          });

          if (!existing) {
            friendCode = code;
            break;
          }
        }

        if (friendCode) {
          await prisma.user.update({
            where: { id: userId },
            data: { friendCode },
          });
          console.log(
            `Generated friendCode ${friendCode} for anonymous user ${userId}`
          );
        }
      }
    }

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
