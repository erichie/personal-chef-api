#!/usr/bin/env tsx
/**
 * Script to populate friendCode for existing users
 * Run with: npx tsx scripts/populate-friend-codes.ts
 */

import { prisma } from "../lib/prisma";
import { createId } from "@paralleldrive/cuid2";

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
    const friendCode = createId();
    await prisma.user.update({
      where: { id: user.id },
      data: { friendCode },
    });

    const userLabel = user.email || user.deviceId;
    console.log(`✓ User ${userLabel}: ${friendCode}`);
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
