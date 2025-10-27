import { searchRecipesByPreferences } from "../lib/recipe-search-utils";
import { generatePreferencesEmbedding } from "../lib/embedding-utils";
import { prisma } from "../lib/prisma";

async function testSemanticSearch() {
  console.log("\n=== Testing Semantic Search ===\n");

  // Test preferences (similar to your actual request)
  const preferences = {
    dietStyle: "omnivore",
    goals: ["USE_WHAT_I_HAVE", "EAT_HEALTHIER", "TRY_NEW_RECIPES"],
    cuisinePreferences: [
      { cuisine: "ITALIAN", level: "LOVE" },
      { cuisine: "MEXICAN", level: "LOVE" },
      { cuisine: "JAPANESE", level: "LOVE" },
      { cuisine: "CHINESE", level: "LOVE" },
      { cuisine: "THAI", level: "LOVE" },
      { cuisine: "INDIAN", level: "LOVE" },
      { cuisine: "KOREAN", level: "LOVE" },
      { cuisine: "AMERICAN_CLASSIC", level: "LOVE" },
      { cuisine: "CARIBBEAN", level: "LIKE" },
    ],
    cookingSkillLevel: "intermediate",
    maxDinnerMinutes: 45,
  };

  // Generate preference embedding
  console.log("Generating preference embedding...");
  const prefEmbedding = await generatePreferencesEmbedding(preferences);
  console.log(
    `✓ Generated embedding with ${prefEmbedding.length} dimensions\n`
  );

  // Get a sample recipe from DB and calculate similarity manually
  const sampleRecipes = await prisma.$queryRaw<
    Array<{
      title: string;
      tags: unknown;
    }>
  >`
    SELECT title, tags FROM "Recipe" WHERE embedding IS NOT NULL LIMIT 1
  `;

  if (sampleRecipes && sampleRecipes.length > 0) {
    const sampleRecipe = sampleRecipes[0];
    console.log(`Sample recipe: "${sampleRecipe.title}"`);
    console.log(
      `Tags: ${(sampleRecipe.tags as string[] | null)?.join(", ") || "none"}`
    );

    // Try to calculate similarity manually
    const query = `
      SELECT 
        title,
        tags,
        1 - (embedding <=> $1::vector) as similarity
      FROM "Recipe"
      WHERE embedding IS NOT NULL
      ORDER BY similarity DESC
      LIMIT 5
    `;

    const results = await prisma.$queryRawUnsafe<
      Array<{
        title: string;
        tags: unknown;
        similarity: number;
      }>
    >(query, `[${prefEmbedding.join(",")}]`);

    console.log("\nManual similarity calculation:");
    results.forEach((r, i) => {
      const tags = r.tags as string[] | null;
      console.log(
        `  ${i + 1}. ${r.title} (${r.similarity.toFixed(3)}) - tags: ${
          tags?.join(", ") || "none"
        }`
      );
    });
  }

  // Now test the search function
  console.log("\n\nTesting searchRecipesByPreferences function:");
  const searchResults = await searchRecipesByPreferences(preferences, {
    limit: 10,
    minSimilarity: 0.3,
  });

  console.log(`Found ${searchResults.length} recipes\n`);

  if (searchResults.length > 0) {
    searchResults.slice(0, 5).forEach((r, i) => {
      const tags = r.tags as string[] | null;
      console.log(
        `  ${i + 1}. ${r.title} (${r.similarity.toFixed(3)}) - tags: ${
          tags?.join(", ") || "none"
        }`
      );
    });
  } else {
    console.log("  ⚠️  No results found!");
  }

  // Test with lower threshold
  console.log("\n\nTrying with minSimilarity = 0.0:");
  const allResults = await searchRecipesByPreferences(preferences, {
    limit: 10,
    minSimilarity: 0.0,
  });

  console.log(`Found ${allResults.length} recipes\n`);

  if (allResults.length > 0) {
    allResults.slice(0, 5).forEach((r, i) => {
      const tags = r.tags as string[] | null;
      console.log(
        `  ${i + 1}. ${r.title} (${r.similarity.toFixed(3)}) - tags: ${
          tags?.join(", ") || "none"
        }`
      );
    });
  }

  await prisma.$disconnect();
}

testSemanticSearch().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
