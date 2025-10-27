import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { generateFriendCode } from "./friend-code-generator";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true when email service is set up
  },
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
    // Generate friend code for new users
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
        where: { id: user.id },
        data: { friendCode },
      });
    }
  },
});

export type Session = typeof auth.$Infer.Session.session;
export type AuthUser = typeof auth.$Infer.Session.user;
