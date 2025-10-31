import { prisma } from "../lib/prisma";

async function fixMealPlanRecipeIds() {
  console.log("=== Fixing Meal Plan Recipe IDs ===\n");

  // Get all meal plans
  const mealPlans = await prisma.mealPlan.findMany();

  console.log(`Found ${mealPlans.length} meal plans\n`);

  for (const mealPlan of mealPlans) {
    console.log(`\nProcessing: ${mealPlan.title} (${mealPlan.id})`);

    const days = mealPlan.days as any[];
    let updated = false;

    for (const day of days) {
      for (const mealType of ["breakfast", "lunch", "dinner"]) {
        const meal = day.meals[mealType];

        if (meal && (!meal.recipeId || meal.recipeId === "")) {
          // Try to find recipe by title and userId
          const recipe = await prisma.recipe.findFirst({
            where: {
              userId: mealPlan.userId,
              title: meal.title,
            },
            select: {
              id: true,
              title: true,
            },
          });

          if (recipe) {
            console.log(`  ✅ Found recipe for "${meal.title}": ${recipe.id}`);
            meal.recipeId = recipe.id;
            updated = true;
          } else {
            console.log(`  ⚠️  No recipe found for "${meal.title}"`);
          }
        }
      }
    }

    if (updated) {
      // Update the meal plan with populated recipeIds
      await prisma.mealPlan.update({
        where: { id: mealPlan.id },
        data: {
          days: days as any,
        },
      });
      console.log(`  💾 Updated meal plan with recipe IDs`);
    } else {
      console.log(`  ⏭️  No updates needed`);
    }
  }

  console.log("\n=== Done ===");
  await prisma.$disconnect();
}

fixMealPlanRecipeIds().catch(console.error);
