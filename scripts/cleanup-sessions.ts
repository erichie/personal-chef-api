#!/usr/bin/env tsx
/**
 * Script to clean up old duplicate sessions
 * Run with: npx tsx scripts/cleanup-sessions.ts
 */

import { prisma } from "../lib/prisma";

async function cleanupDuplicateSessions() {
  console.log("🧹 Cleaning up duplicate sessions...\n");

  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, email: true, deviceId: true },
  });

  let totalDeleted = 0;

  for (const user of users) {
    // Get all sessions for this user
    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { expiresAt: "desc" },
    });

    if (sessions.length > 1) {
      const userLabel = user.email || user.deviceId;
      console.log(`User ${userLabel}: Found ${sessions.length} sessions`);

      // Keep the most recent valid session, delete the rest
      const [keep, ...toDelete] = sessions;

      const deleted = await prisma.session.deleteMany({
        where: {
          id: {
            in: toDelete.map((s) => s.id),
          },
        },
      });

      totalDeleted += deleted.count;
      console.log(
        `  ✓ Kept 1 session, deleted ${deleted.count} old sessions\n`
      );
    }
  }

  // Also delete any expired sessions
  const expiredDeleted = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  if (expiredDeleted.count > 0) {
    totalDeleted += expiredDeleted.count;
    console.log(`✓ Deleted ${expiredDeleted.count} expired sessions\n`);
  }

  console.log(`\n✅ Total sessions deleted: ${totalDeleted}`);

  // Show final count
  const remainingSessions = await prisma.session.count();
  const totalUsers = await prisma.user.count();
  console.log(
    `📊 Remaining: ${remainingSessions} sessions for ${totalUsers} users`
  );
}

cleanupDuplicateSessions()
  .then(() => {
    console.log("\n✅ Cleanup complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  });
