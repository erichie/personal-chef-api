import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

async function checkRecipeStats() {
  console.log("\n=== Recipe Database Stats ===\n");

  // Total recipes
  const totalRecipes = await prisma.recipe.count();
  console.log(`Total recipes: ${totalRecipes}`);

  // Recipes with embeddings
  const withEmbeddings = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM "Recipe" WHERE embedding IS NOT NULL
  `;
  const embeddedCount = Number(withEmbeddings[0]?.count ?? 0);
  console.log(`Recipes with embeddings: ${embeddedCount}`);
  console.log(`Recipes without embeddings: ${totalRecipes - embeddedCount}\n`);

  // Sample recipes with embeddings
  if (embeddedCount > 0) {
    console.log("Sample recipes with embeddings:");
    const samples = await prisma.$queryRaw<
      Array<{ title: string; tags: unknown; source: string | null }>
    >`
      SELECT title, tags, source 
      FROM "Recipe" 
      WHERE embedding IS NOT NULL 
      LIMIT 5
    `;
    samples.forEach((recipe, i) => {
      const tags = recipe.tags as string[] | null;
      console.log(
        `  ${i + 1}. ${recipe.title} (source: ${recipe.source}, tags: ${
          tags?.join(", ") || "none"
        })`
      );
    });
    console.log("");
  }

  // Sample recipes without embeddings
  if (totalRecipes - embeddedCount > 0) {
    console.log("Sample recipes WITHOUT embeddings:");
    const samples = await prisma.recipe.findMany({
      where: { embedding: null } as Prisma.RecipeWhereInput,
      select: { title: true, tags: true, source: true },
      take: 5,
    });
    samples.forEach((recipe, i) => {
      const tags = recipe.tags as string[] | null;
      console.log(
        `  ${i + 1}. ${recipe.title} (source: ${recipe.source}, tags: ${
          tags?.join(", ") || "none"
        })`
      );
    });
    console.log("");
  }

  // Recipes by source
  console.log("Recipes by source:");
  const bySources = await prisma.recipe.groupBy({
    by: ["source"],
    _count: {
      source: true,
    },
  });
  bySources.forEach((group) => {
    console.log(`  ${group.source || "unknown"}: ${group._count.source}`);
  });

  console.log("\n=========================\n");
  await prisma.$disconnect();
}

checkRecipeStats().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
