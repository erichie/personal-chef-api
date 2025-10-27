import { prisma } from "../lib/prisma";

async function clearRecipeUsage() {
  console.log("\n=== Clearing Recipe Usage Data ===\n");

  // Show current usage count
  const usageCount = await prisma.recipeUsage.count();
  console.log(`Current recipe usage records: ${usageCount}`);

  if (usageCount === 0) {
    console.log("\n✓ No usage records to clear.\n");
    await prisma.$disconnect();
    return;
  }

  // Ask for confirmation (this is just a utility, so we'll just do it)
  console.log("\nClearing all recipe usage records...");

  await prisma.recipeUsage.deleteMany({});

  console.log("✓ All recipe usage records cleared!");
  console.log(
    "\nThis allows all recipes to be selected again in meal plans.\n"
  );

  await prisma.$disconnect();
}

clearRecipeUsage().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
