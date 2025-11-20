import { prisma } from "./prisma";

/**
 * Permanently delete a user and all associated data
 */
export async function deleteUserAccount(userId: string) {
  await prisma.$transaction(async (tx) => {
    // Clean up data without foreign key cascades
    await tx.friendship.deleteMany({
      where: {
        OR: [{ userId }, { friendId: userId }],
      },
    });

    await tx.recipeUsage.deleteMany({
      where: { userId },
    });

    await tx.aiUsage.deleteMany({
      where: { userId },
    });

    // Cascade deletes handle the rest of the related data
    await tx.user.delete({
      where: { id: userId },
    });
  });
}

