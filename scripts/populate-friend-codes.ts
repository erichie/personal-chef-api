#!/usr/bin/env tsx
/**
 * Script to populate friendCode for existing users
 * Run with: npx tsx scripts/populate-friend-codes.ts
 */

import { prisma } from "../lib/prisma";
import {
  generateFriendCode,
  formatFriendCode,
} from "../lib/friend-code-generator";

async function populateFriendCodes() {
  console.log("🔑 Populating friend codes for existing users...\n");

  // Get all users without a friendCode
  const users = await prisma.user.findMany({
    where: {
      friendCode: null,
    },
  });

  if (users.length === 0) {
    console.log("✅ All users already have friend codes!\n");
    return;
  }

  console.log(`Found ${users.length} users without friend codes\n`);

  for (const user of users) {
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
        `❌ Failed to generate unique code for ${user.email || user.id}`
      );
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { friendCode: friendCode! },
    });

    const userLabel = user.email || user.id;
    console.log(`✓ User ${userLabel}: ${formatFriendCode(friendCode!)}`);
  }

  console.log(`\n✅ Updated ${users.length} users with friend codes`);
}

populateFriendCodes()
  .then(() => {
    console.log("\n✅ Complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
