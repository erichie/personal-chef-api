import { prisma } from "../lib/prisma";
import { getMealPlan, enrichMealPlanWithRecipes } from "../lib/meal-plan-utils";

async function testMealPlanEnrichment() {
  console.log("=== Testing Meal Plan Enrichment ===\n");

  // Get all meal plans
  const mealPlans = await prisma.mealPlan.findMany({
    take: 1,
  });

  if (mealPlans.length === 0) {
    console.log("No meal plans found in database");
    await prisma.$disconnect();
    return;
  }

  const mealPlan = mealPlans[0];
  console.log("Testing with meal plan:", mealPlan.id);
  console.log("Title:", mealPlan.title);
  console.log("\nDays structure:");
  console.log(JSON.stringify(mealPlan.days, null, 2));

  // Test getMealPlan
  console.log("\n=== Testing getMealPlan() ===");
  const retrieved = await getMealPlan(mealPlan.id);
  console.log("Retrieved days:");
  console.log(JSON.stringify(retrieved.days, null, 2));

  // Extract recipe IDs
  console.log("\n=== Extracting Recipe IDs ===");
  const recipeIds = new Set<string>();
  const days = retrieved.days as any[];

  for (const day of days) {
    console.log(`Day ${day.dayNumber}:`);
    if (day.meals.breakfast?.recipeId) {
      console.log(`  breakfast: ${day.meals.breakfast.recipeId}`);
      recipeIds.add(day.meals.breakfast.recipeId);
    }
    if (day.meals.lunch?.recipeId) {
      console.log(`  lunch: ${day.meals.lunch.recipeId}`);
      recipeIds.add(day.meals.lunch.recipeId);
    }
    if (day.meals.dinner?.recipeId) {
      console.log(`  dinner: ${day.meals.dinner.recipeId}`);
      recipeIds.add(day.meals.dinner.recipeId);
    }
  }

  console.log("\nUnique recipe IDs found:", Array.from(recipeIds));

  // Check if recipes exist
  console.log("\n=== Checking Recipes in Database ===");
  for (const recipeId of recipeIds) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: {
        id: true,
        title: true,
        ingredients: true,
        steps: true,
      },
    });

    if (recipe) {
      console.log(`✅ Found: ${recipe.title} (${recipe.id})`);
      console.log(
        `   - Has ingredients: ${!!(recipe.ingredients as any)?.length}`
      );
      console.log(`   - Has steps: ${!!(recipe.steps as any)?.length}`);
    } else {
      console.log(`❌ NOT FOUND: ${recipeId}`);
    }
  }

  // Test enrichment
  console.log("\n=== Testing enrichMealPlanWithRecipes() ===");
  const enriched = await enrichMealPlanWithRecipes(retrieved);
  console.log("Enriched recipes count:", enriched.recipes?.length || 0);

  if (enriched.recipes && enriched.recipes.length > 0) {
    console.log("\nEnriched recipes:");
    enriched.recipes.forEach((r) => {
      console.log(`  - ${r.title} (${r.id})`);
      console.log(`    Ingredients: ${r.ingredients?.length || 0}`);
      console.log(`    Steps: ${r.steps?.length || 0}`);
    });
  } else {
    console.log("❌ No recipes in enriched meal plan!");
  }

  await prisma.$disconnect();
}

testMealPlanEnrichment().catch(console.error);
