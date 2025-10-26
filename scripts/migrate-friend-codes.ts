#!/usr/bin/env tsx
/**
 * Script to migrate all users to new 8-character friend codes
 * This will replace ALL existing friend codes with new short codes
 *
 * Run with: npx tsx scripts/migrate-friend-codes.ts
 */

import { prisma } from "../lib/prisma";
import {
  generateFriendCode,
  formatFriendCode,
} from "../lib/friend-code-generator";

async function migrateFriendCodes() {
  console.log("🔄 Migrating all users to new 8-character friend codes...\n");

  // Get ALL users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      deviceId: true,
      friendCode: true,
    },
  });

  if (users.length === 0) {
    console.log("No users found in the database.\n");
    return;
  }

  console.log(`Found ${users.length} users to migrate\n`);

  let migrated = 0;
  const codeMap: Array<{ user: string; old: string; new: string }> = [];

  for (const user of users) {
    const oldCode = user.friendCode || "(none)";

    // Generate a unique friend code (retry if collision)
    let friendCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      friendCode = generateFriendCode();
      const existing = await prisma.user.findUnique({
        where: { friendCode },
      });

      if (!existing) {
        break;
      }
      attempts++;
    }

    if (attempts === maxAttempts) {
      console.error(
        `❌ Failed to generate unique code for ${user.email || user.deviceId}`
      );
      continue;
    }

    // Update the user
    await prisma.user.update({
      where: { id: user.id },
      data: { friendCode: friendCode! },
    });

    const userLabel = user.email || user.deviceId?.slice(0, 25);
    console.log(`✓ ${userLabel}`);
    console.log(`  Old: ${oldCode}`);
    console.log(`  New: ${formatFriendCode(friendCode!)} (${friendCode!})\n`);

    codeMap.push({
      user: userLabel || "unknown",
      old: oldCode,
      new: friendCode!,
    });

    migrated++;
  }

  console.log(
    `\n✅ Successfully migrated ${migrated} users to new friend codes`
  );

  // Print summary table
  console.log("\n📋 Migration Summary:");
  console.log("─".repeat(80));
  codeMap.forEach(({ user, old, new: newCode }) => {
    console.log(
      `${user.padEnd(30)} ${old.slice(0, 24).padEnd(24)} → ${formatFriendCode(
        newCode
      )}`
    );
  });
  console.log("─".repeat(80));
}

migrateFriendCodes()
  .then(() => {
    console.log("\n✅ Migration Complete!");
    console.log("\n⚠️  Important: Friend codes have changed!");
    console.log("   Users will need to share their new codes with friends.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
