import { prisma } from "../lib/prisma";
import { getFriendIds } from "../lib/friend-utils";

async function debugFriendship() {
  const userId1 = "FLzFUIYGXENTebrgDCRvlqqE3BngWFMf";

  console.log("=== Debugging Friendship ===\n");

  // Get user details
  const user = await prisma.user.findUnique({
    where: { id: userId1 },
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  });

  console.log("User:", user);
  console.log();

  // Check all friendships involving this user
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userId: userId1 }, { friendId: userId1 }],
    },
  });

  console.log("All friendships:", friendships.length);
  friendships.forEach((f) => {
    console.log(`  - ${f.id}:`);
    console.log(`    userId: ${f.userId}`);
    console.log(`    friendId: ${f.friendId}`);
    console.log(`    status: ${f.status}`);
    console.log(
      `    direction: ${f.userId === userId1 ? "outgoing" : "incoming"}`
    );
  });
  console.log();

  // Get friend IDs using the function
  const friendIds = await getFriendIds(userId1);
  console.log("Friend IDs from getFriendIds():", friendIds);
  console.log();

  // Get all users to see who they might be trying to share with
  const allUsers = await prisma.user.findMany({
    where: {
      id: { not: userId1 },
    },
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  });

  console.log("Other users in system:");
  allUsers.forEach((u) => {
    const isFriend = friendIds.includes(u.id);
    console.log(
      `  - ${u.displayName || u.email} (${u.id.substring(0, 8)}...): ${
        isFriend ? "✅ FRIEND" : "❌ NOT FRIEND"
      }`
    );
  });

  await prisma.$disconnect();
}

debugFriendship().catch(console.error);
