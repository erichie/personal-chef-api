import { NextRequest } from "next/server";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { errors } from "./api-errors";
import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcrypt";
import { generateFriendCode } from "./friend-code-generator";

/**
 * Extract session token from request headers
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Check cookie
  const cookieToken = request.cookies.get("better-auth.session_token")?.value;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * Get session from request
 */
export async function getSessionFromRequest(request: NextRequest) {
  const token = getTokenFromRequest(request);

  if (!token) {
    throw errors.unauthorized("No session token provided");
  }

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw errors.unauthorized("Invalid or expired session");
    }

    return session;
  } catch (error) {
    throw errors.unauthorized("Failed to validate session");
  }
}

/**
 * Get user from session
 */
export async function getUserFromSession(session: { user: { id: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
    },
  });

  if (!user) {
    throw errors.notFound("User not found");
  }

  return user;
}

/**
 * Get user from request (combines session and user lookup)
 */
export async function getUserFromRequest(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  return getUserFromSession(session);
}

/**
 * Generate a unique friend code (with collision detection)
 */
async function generateUniqueFriendCode(): Promise<string> {
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateFriendCode();

    // Check if code already exists
    const existing = await prisma.user.findUnique({
      where: { friendCode: code },
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error("Failed to generate unique friend code after 10 attempts");
}

/**
 * Create a guest user
 */
export async function createGuestUser(deviceId: string) {
  // Check if guest user already exists with this deviceId
  const existingUser = await prisma.user.findUnique({
    where: { deviceId },
  });

  if (existingUser) {
    // If existing user doesn't have a friend code, add one
    if (!existingUser.friendCode) {
      const friendCode = await generateUniqueFriendCode();
      return prisma.user.update({
        where: { id: existingUser.id },
        data: { friendCode },
      });
    }
    return existingUser;
  }

  // Generate unique friend code for new user
  const friendCode = await generateUniqueFriendCode();

  // Create new guest user
  const user = await prisma.user.create({
    data: {
      id: uuidv4(),
      deviceId,
      isGuest: true,
      email: null,
      passwordHash: null,
      friendCode,
    },
  });

  // Create empty profile for the guest user
  await prisma.userProfile.create({
    data: {
      userId: user.id,
    },
  });

  return user;
}

/**
 * Create session for user (or return existing valid session)
 */
export async function createSessionForUser(userId: string) {
  // Check if user already has a valid session
  const existingSession = await prisma.session.findFirst({
    where: {
      userId,
      expiresAt: {
        gt: new Date(), // Only consider sessions that haven't expired
      },
    },
    orderBy: {
      expiresAt: "desc", // Get the most recent one
    },
  });

  if (existingSession) {
    return existingSession;
  }

  // Create new session if none exists or all are expired
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const token = uuidv4();

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress: null,
      userAgent: null,
    },
  });

  return session;
}

/**
 * Migrate guest data to authenticated user
 */
export async function migrateGuestData(
  guestUserId: string,
  targetUserId: string
) {
  // Fetch guest profile
  const guestProfile = await prisma.userProfile.findUnique({
    where: { userId: guestUserId },
  });

  // Fetch target profile (might not exist yet)
  let targetProfile = await prisma.userProfile.findUnique({
    where: { userId: targetUserId },
  });

  // If target doesn't have a profile, create one
  if (!targetProfile) {
    targetProfile = await prisma.userProfile.create({
      data: {
        userId: targetUserId,
      },
    });
  }

  // Merge guest profile data into target profile
  if (guestProfile) {
    await prisma.userProfile.update({
      where: { userId: targetUserId },
      data: {
        chefIntake: (guestProfile.chefIntake ??
          targetProfile.chefIntake) as any,
        inventory: (guestProfile.inventory ?? targetProfile.inventory) as any,
        mealPlans: (guestProfile.mealPlans ?? targetProfile.mealPlans) as any,
        groceryList: (guestProfile.groceryList ??
          targetProfile.groceryList) as any,
        achievements: (guestProfile.achievements ??
          targetProfile.achievements) as any,
        streaks: (guestProfile.streaks ?? targetProfile.streaks) as any,
        tokenState: (guestProfile.tokenState ??
          targetProfile.tokenState) as any,
        syncVersion: Math.max(
          guestProfile.syncVersion,
          targetProfile.syncVersion
        ),
      },
    });
  }

  // Migrate recipes
  await prisma.recipe.updateMany({
    where: { userId: guestUserId },
    data: { userId: targetUserId },
  });

  // Delete guest profile
  if (guestProfile) {
    await prisma.userProfile.delete({
      where: { userId: guestUserId },
    });
  }

  // Delete guest sessions
  await prisma.session.deleteMany({
    where: { userId: guestUserId },
  });

  // Delete guest user
  await prisma.user.delete({
    where: { id: guestUserId },
  });
}

/**
 * Hash password for storage
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check if request has valid authentication (guest or registered)
 */
export async function requireAuth(request: NextRequest) {
  // First check for session token (standard auth)
  const token = getTokenFromRequest(request);
  if (token) {
    try {
      const session = await getSessionFromRequest(request);
      const user = await getUserFromSession(session);
      return { user, session };
    } catch (error) {
      // Continue to check device ID
    }
  }

  // Check for device ID (guest auth)
  const deviceId = request.headers.get("X-Device-ID");
  if (deviceId) {
    const user = await prisma.user.findUnique({
      where: { deviceId },
      include: { profile: true },
    });

    if (user && user.isGuest) {
      return { user, session: null };
    }
  }

  throw errors.unauthorized("Authentication required");
}

/**
 * Clean up expired sessions from the database
 */
export async function cleanupExpiredSessions() {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  return result.count;
}
