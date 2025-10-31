import { prisma } from "../lib/prisma";

async function checkPost() {
  const postId = "962d4612-96a6-4f6f-842a-a90ae2947d99";

  // Check if post exists
  const post = await prisma.mealPlanPost.findUnique({
    where: { id: postId },
  });

  console.log("Post exists:", !!post);
  if (post) {
    console.log("Post details:", post);
  }

  // Check all meal plan posts
  const allPosts = await prisma.mealPlanPost.findMany();
  console.log("\nTotal meal plan posts:", allPosts.length);
  if (allPosts.length > 0) {
    console.log("Available post IDs:");
    allPosts.forEach((p) => {
      console.log(`  - ${p.id} (mealPlanId: ${p.mealPlanId})`);
    });
  }

  await prisma.$disconnect();
}

checkPost().catch(console.error);
