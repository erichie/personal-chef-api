import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { anonymous } from "better-auth/plugins";
import { prisma } from "./prisma";
import { generateFriendCode } from "./friend-code-generator";
import { Prisma } from "@prisma/client";
import { ensureCookbookSlug } from "./cookbook-utils";

/**
 * Helper function to ensure a user has a friend code
 */
async function ensureUserHasFriendCode(userId: string): Promise<void> {
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
    console.log(`Generated friendCode ${friendCode} for user ${userId}`);
    await prisma.user.update({
      where: { id: userId },
      data: { friendCode },
    });
  } else {
    console.error(`Failed to generate unique friendCode for user ${userId}`);
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    fields: {
      name: "displayName", // Map 'name' field to 'displayName' in schema
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true when email service is set up
  },
  plugins: [
    anonymous({
      async onLinkAccount({ anonymousUser, newUser }) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anonUser = anonymousUser.user as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const registeredUser = newUser.user as any;

        console.log(
          `onLinkAccount: Migrating from anonymous ${anonUser.id} to registered ${registeredUser.id}`
        );
        console.log(
          `Anonymous friendCode: ${anonUser.friendCode}, Registered friendCode: ${registeredUser.friendCode}`
        );

        // Get anonymous user's profile
        const anonymousProfile = await prisma.userProfile.findUnique({
          where: { userId: anonUser.id },
        });

        // Get or create new user's profile
        let newProfile = await prisma.userProfile.findUnique({
          where: { userId: registeredUser.id },
        });

        if (!newProfile) {
          newProfile = await prisma.userProfile.create({
            data: { userId: registeredUser.id },
          });
        }

        // Migrate profile data from anonymous to new user
        if (anonymousProfile) {
          await prisma.userProfile.update({
            where: { userId: registeredUser.id },
            data: {
              chefIntake: anonymousProfile.chefIntake as Prisma.InputJsonValue,
              inventory: anonymousProfile.inventory as Prisma.InputJsonValue,
              mealPlans: anonymousProfile.mealPlans as Prisma.InputJsonValue,
              groceryList:
                anonymousProfile.groceryList as Prisma.InputJsonValue,
              achievements:
                anonymousProfile.achievements as Prisma.InputJsonValue,
              streaks: anonymousProfile.streaks as Prisma.InputJsonValue,
              tokenState: anonymousProfile.tokenState as Prisma.InputJsonValue,
              lastSyncedAt: anonymousProfile.lastSyncedAt,
              syncVersion: anonymousProfile.syncVersion,
            },
          });
        }

        // Migrate recipes
        await prisma.recipe.updateMany({
          where: { userId: anonUser.id },
          data: { userId: registeredUser.id },
        });

        // Migrate posts
        await prisma.recipePost.updateMany({
          where: { userId: anonUser.id },
          data: { userId: registeredUser.id },
        });

        // Migrate post likes
        await prisma.postLike.updateMany({
          where: { userId: anonUser.id },
          data: { userId: registeredUser.id },
        });

        // Migrate comments
        await prisma.postComment.updateMany({
          where: { userId: anonUser.id },
          data: { userId: registeredUser.id },
        });

        // Migrate friendships (both as user and as friend)
        await prisma.friendship.updateMany({
          where: { userId: anonUser.id },
          data: { userId: registeredUser.id },
        });

        await prisma.friendship.updateMany({
          where: { friendId: anonUser.id },
          data: { friendId: registeredUser.id },
        });

        // Migrate feed activities
        await prisma.feedActivity.updateMany({
          where: { userId: anonUser.id },
          data: { userId: registeredUser.id },
        });

        // Copy friendCode to new user if anonymous had one
        // Or generate one if neither user has one
        if (anonUser.friendCode) {
          console.log(`Copying friendCode ${anonUser.friendCode} to new user`);
          await prisma.user.update({
            where: { id: registeredUser.id },
            data: { friendCode: anonUser.friendCode },
          });
        } else if (!registeredUser.friendCode) {
          // Neither user has a friend code, generate one
          console.log(`No friendCode found, generating new one`);
          await ensureUserHasFriendCode(registeredUser.id);
        }

        // Verify friend code was set
        const finalUser = await prisma.user.findUnique({
          where: { id: registeredUser.id },
          select: { friendCode: true },
        });
        console.log(
          `Final friendCode for user ${registeredUser.id}: ${finalUser?.friendCode}`
        );

        try {
          await ensureCookbookSlug(registeredUser.id);
        } catch (error) {
          console.error("Failed to ensure cookbook slug for user", error);
        }

        // Delete anonymous user's profile (cascade will handle the rest)
        if (anonymousProfile) {
          await prisma.userProfile.delete({
            where: { userId: anonUser.id },
          });
        }

        console.log(`Data migration complete for user ${registeredUser.id}`);
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
    // Add production URLs when deploying
  ],
  onAfterSignUp: async (user: { id: string; email?: string }) => {
    // Generate friend code for new users (registered sign-ups without anonymous conversion)
    console.log(`onAfterSignUp called for user ${user.id}`);
    await ensureUserHasFriendCode(user.id);
    console.log(`Friend code ensured for user ${user.id}`);
    try {
      await ensureCookbookSlug(user.id);
      console.log(`Cookbook slug ensured for user ${user.id}`);
    } catch (error) {
      console.error("Failed to ensure cookbook slug", error);
    }
  },
});

export type Session = typeof auth.$Infer.Session.session;
export type AuthUser = typeof auth.$Infer.Session.user;
