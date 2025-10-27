#!/usr/bin/env tsx
/**
 * Backfill embeddings for existing recipes that don't have them
 * Run with: npx tsx scripts/backfill-recipe-embeddings.ts
 */

import { prisma } from "../lib/prisma";
import { generateRecipeEmbedding } from "../lib/embedding-utils";

async function backfillRecipeEmbeddings() {
  console.log("🔍 Finding recipes without embeddings...\n");

  // Get all recipes without embeddings
  const recipesWithoutEmbeddings = await prisma.$queryRaw<
    Array<{ id: string; title: string }>
  >`
    SELECT id, title
    FROM "Recipe"
    WHERE embedding IS NULL
  `;

  if (recipesWithoutEmbeddings.length === 0) {
    console.log("✅ All recipes already have embeddings!\n");
    return;
  }

  console.log(
    `Found ${recipesWithoutEmbeddings.length} recipes without embeddings\n`
  );

  let successCount = 0;
  let errorCount = 0;

  for (const recipeRef of recipesWithoutEmbeddings) {
    try {
      // Fetch full recipe data
      const recipe = await prisma.recipe.findUnique({
        where: { id: recipeRef.id },
      });

      if (!recipe) {
        console.log(`⚠️  Recipe ${recipeRef.id} not found, skipping...`);
        continue;
      }

      console.log(`Processing: ${recipe.title}`);

      // Generate embedding
      const embedding = await generateRecipeEmbedding({
        title: recipe.title,
        description: recipe.description,
        tags: recipe.tags,
        ingredients: recipe.ingredients,
      });

      // Update recipe with embedding using raw SQL
      await prisma.$executeRawUnsafe(
        `UPDATE "Recipe" SET embedding = $1::vector, "embeddingVersion" = 1 WHERE id = $2`,
        `[${embedding.join(",")}]`,
        recipe.id
      );

      successCount++;
      console.log(`  ✓ Generated embedding (${embedding.length} dimensions)\n`);
    } catch (error) {
      errorCount++;
      console.error(`  ✗ Error: ${error}`);
      console.error(`  Skipping recipe: ${recipeRef.title}\n`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Successfully processed: ${successCount} recipes`);
  if (errorCount > 0) {
    console.log(`⚠️  Errors: ${errorCount} recipes`);
  }
  console.log("=".repeat(50) + "\n");
}

backfillRecipeEmbeddings()
  .then(() => {
    console.log("✅ Backfill complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
