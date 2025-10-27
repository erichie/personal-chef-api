import { prisma } from "../lib/prisma";

async function checkRecipeUsage() {
  console.log("\n=== Recipe Usage Report ===\n");

  // Total usage records
  const totalUsage = await prisma.recipeUsage.count();
  console.log(`Total usage records: ${totalUsage}`);

  // Group by recipe
  const usageByRecipe = await prisma.recipeUsage.groupBy({
    by: ["recipeId"],
    _count: {
      recipeId: true,
    },
    orderBy: {
      _count: {
        recipeId: "desc",
      },
    },
    take: 10,
  });

  console.log(`\nMost used recipes:`);
  for (const usage of usageByRecipe) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: usage.recipeId },
      select: { title: true },
    });
    console.log(
      `  ${recipe?.title || "Unknown"}: ${usage._count.recipeId} times`
    );
  }

  // Recent usage (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentUsage = await prisma.recipeUsage.count({
    where: {
      usedAt: {
        gte: sevenDaysAgo,
      },
    },
  });

  console.log(`\nRecipes used in last 7 days: ${recentUsage}`);

  // Get unique recipes used recently
  const recentUniqueRecipes = await prisma.recipeUsage.findMany({
    where: {
      usedAt: {
        gte: sevenDaysAgo,
      },
    },
    select: {
      recipeId: true,
    },
    distinct: ["recipeId"],
  });

  console.log(
    `Unique recipes used in last 7 days: ${recentUniqueRecipes.length}`
  );

  // Check last 14 days
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const recentUniqueRecipes14 = await prisma.recipeUsage.findMany({
    where: {
      usedAt: {
        gte: fourteenDaysAgo,
      },
    },
    select: {
      recipeId: true,
    },
    distinct: ["recipeId"],
  });

  console.log(
    `Unique recipes used in last 14 days: ${recentUniqueRecipes14.length}`
  );

  const totalRecipes = await prisma.recipe.count();
  const percentExcluded = (
    (recentUniqueRecipes14.length / totalRecipes) *
    100
  ).toFixed(1);

  console.log(
    `\n📊 Impact: ${percentExcluded}% of database would be excluded (${recentUniqueRecipes14.length}/${totalRecipes} recipes)`
  );

  if (recentUniqueRecipes14.length > totalRecipes * 0.5) {
    console.log(`\n⚠️  WARNING: More than 50% of recipes would be excluded!`);
    console.log(
      `   The smart exclusion logic will automatically reduce the exclusion period.`
    );
  }

  console.log("\n=========================\n");
  await prisma.$disconnect();
}

checkRecipeUsage().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
