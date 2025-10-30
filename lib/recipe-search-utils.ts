import { prisma } from "./prisma";
import {
  generatePreferencesEmbedding,
  embeddingToPostgresVector,
  cosineSimilarity,
  postgresVectorToEmbedding,
} from "./embedding-utils";
import { Prisma } from "@prisma/client";

export interface RecipeWithSimilarity {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  servings: number | null;
  totalMinutes: number | null;
  tags: unknown;
  ingredients: unknown;
  steps: unknown;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
  similarity: number;
}

interface SearchPreferences {
  dietStyle?: string;
  goals?: string[];
  allergies?: string[];
  exclusions?: string[];
  cuisinePreferences?: Array<{
    cuisine: string;
    level: string;
  }>;
  cookingSkillLevel?: string;
  maxDinnerMinutes?: number;
  householdSize?: number;
  preferencesExplanation?: string;
}

/**
 * Search for recipes by user preferences using semantic similarity
 */
export async function searchRecipesByPreferences(
  preferences: SearchPreferences,
  options: {
    limit?: number;
    userId?: string;
    excludeRecipeIds?: string[];
    minSimilarity?: number;
  } = {}
): Promise<RecipeWithSimilarity[]> {
  const {
    limit = 50,
    userId,
    excludeRecipeIds = [],
    minSimilarity = 0.5,
  } = options;

  // Generate embedding for preferences
  const preferencesEmbedding = await generatePreferencesEmbedding(preferences);
  const vectorStr = embeddingToPostgresVector(preferencesEmbedding);

  // Build WHERE conditions for hard filters
  const conditions: string[] = [];
  const params: any[] = [vectorStr];
  let paramIndex = 2;

  // Filter by max cooking time
  if (preferences.maxDinnerMinutes) {
    conditions.push(
      `("totalMinutes" IS NULL OR "totalMinutes" <= $${paramIndex})`
    );
    params.push(preferences.maxDinnerMinutes);
    paramIndex++;
  }

  // Exclude specific recipes
  if (excludeRecipeIds.length > 0) {
    conditions.push(
      `id NOT IN (${excludeRecipeIds.map(() => `$${paramIndex++}`).join(",")})`
    );
    params.push(...excludeRecipeIds);
  }

  // Only search recipes with embeddings
  conditions.push("embedding IS NOT NULL");

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Use cosine distance operator (<=>)
  // Lower distance = more similar
  const query = `
    SELECT 
      id,
      "userId",
      title,
      description,
      servings,
      "totalMinutes",
      tags,
      ingredients,
      steps,
      source,
      "createdAt",
      "updatedAt",
      1 - (embedding <=> $1::vector) as similarity
    FROM "Recipe"
    ${whereClause}
    ORDER BY embedding <=> $1::vector
    LIMIT $${paramIndex}
  `;

  params.push(limit);

  const recipes = await prisma.$queryRawUnsafe<RecipeWithSimilarity[]>(
    query,
    ...params
  );

  // Filter by allergies and exclusions (check ingredients)
  const filtered = recipes.filter((recipe) => {
    // Apply similarity threshold
    if (recipe.similarity < minSimilarity) {
      return false;
    }

    // Check for allergens
    if (preferences.allergies && preferences.allergies.length > 0) {
      if (containsAllergens(recipe, preferences.allergies)) {
        return false;
      }
    }

    // Check for exclusions
    if (preferences.exclusions && preferences.exclusions.length > 0) {
      if (containsExclusions(recipe, preferences.exclusions)) {
        return false;
      }
    }

    return true;
  });

  return filtered;
}

/**
 * Get recently used recipes for a user (last N days)
 */
export async function getRecentlyUsedRecipes(
  userId: string,
  days: number = 14
): Promise<string[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const usages = await prisma.recipeUsage.findMany({
    where: {
      userId,
      usedAt: {
        gte: cutoffDate,
      },
    },
    select: {
      recipeId: true,
    },
    distinct: ["recipeId"],
  });

  return usages.map((u) => u.recipeId);
}

/**
 * Record recipe usage for a user
 */
export async function recordRecipeUsage(
  userId: string,
  recipeIds: string[]
): Promise<void> {
  if (recipeIds.length === 0) return;

  await prisma.recipeUsage.createMany({
    data: recipeIds.map((recipeId) => ({
      userId,
      recipeId,
    })),
  });
}

/**
 * Check if recipe contains allergens
 */
function containsAllergens(
  recipe: RecipeWithSimilarity,
  allergens: string[]
): boolean {
  const ingredients = recipe.ingredients as Array<{ name: string }> | undefined;
  if (!ingredients) return false;

  const allergenPatterns = allergens.map((a) =>
    a.toLowerCase().replace(/\s+/g, "")
  );

  for (const ingredient of ingredients) {
    const ingredientName = ingredient.name.toLowerCase().replace(/\s+/g, "");

    for (const allergen of allergenPatterns) {
      if (ingredientName.includes(allergen)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if recipe contains excluded ingredients
 */
function containsExclusions(
  recipe: RecipeWithSimilarity,
  exclusions: string[]
): boolean {
  const ingredients = recipe.ingredients as Array<{ name: string }> | undefined;
  if (!ingredients) return false;

  // Check title and description for exclusions too
  const fullText = `${recipe.title} ${recipe.description || ""}`.toLowerCase();

  const exclusionPatterns = exclusions.map((e) =>
    e.toLowerCase().replace(/\s+/g, "")
  );

  // Check in title/description
  for (const exclusion of exclusionPatterns) {
    if (fullText.replace(/\s+/g, "").includes(exclusion)) {
      return true;
    }
  }

  // Check in ingredients
  for (const ingredient of ingredients) {
    const ingredientName = ingredient.name.toLowerCase().replace(/\s+/g, "");

    for (const exclusion of exclusionPatterns) {
      if (ingredientName.includes(exclusion)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check for duplicate recipes
 * Returns true if the recipe is too similar to existing ones
 */
export function isDuplicateRecipe(
  title: string,
  ingredients: Array<{ name: string; canonicalId?: string }>,
  existingRecipes: Array<{
    title: string;
    ingredients: unknown;
  }>
): boolean {
  const normalizedTitle = normalizeTitle(title);

  for (const existing of existingRecipes) {
    const existingNormalizedTitle = normalizeTitle(existing.title);

    // Check title similarity
    if (areTitlesSimilar(normalizedTitle, existingNormalizedTitle)) {
      return true;
    }

    // Check ingredient overlap
    const existingIngredients = existing.ingredients as Array<{
      name: string;
      canonicalId?: string;
    }>;
    if (existingIngredients) {
      const overlapPercentage = calculateIngredientOverlap(
        ingredients,
        existingIngredients
      );
      if (overlapPercentage > 0.7) {
        // 70% ingredient overlap
        return true;
      }
    }
  }

  return false;
}

/**
 * Normalize recipe title for comparison
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Check if two titles are similar enough to be considered duplicates
 */
function areTitlesSimilar(title1: string, title2: string): boolean {
  // Exact match
  if (title1 === title2) return true;

  // Check if one contains the other (with some length threshold)
  if (title1.length > 10 && title2.length > 10) {
    if (title1.includes(title2) || title2.includes(title1)) {
      return true;
    }
  }

  // Simple word overlap check
  const words1 = new Set(title1.split(" ").filter((w) => w.length > 3));
  const words2 = new Set(title2.split(" ").filter((w) => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return false;

  let commonWords = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      commonWords++;
    }
  }

  const minSize = Math.min(words1.size, words2.size);
  const overlapRatio = commonWords / minSize;

  return overlapRatio > 0.7; // 70% word overlap
}

/**
 * Calculate ingredient overlap between two recipes
 */
function calculateIngredientOverlap(
  ingredients1: Array<{ name: string; canonicalId?: string }>,
  ingredients2: Array<{ name: string; canonicalId?: string }>
): number {
  if (ingredients1.length === 0 || ingredients2.length === 0) return 0;

  // Use canonicalId if available, otherwise normalize names
  const set1 = new Set(
    ingredients1.map(
      (ing) =>
        ing.canonicalId ||
        ing.name
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, "_")
    )
  );

  const set2 = new Set(
    ingredients2.map(
      (ing) =>
        ing.canonicalId ||
        ing.name
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, "_")
    )
  );

  let commonCount = 0;
  for (const item of set1) {
    if (set2.has(item)) {
      commonCount++;
    }
  }

  const minSize = Math.min(set1.size, set2.size);
  return commonCount / minSize;
}

/**
 * Get total recipe count in database
 */
export async function getTotalRecipeCount(): Promise<number> {
  return prisma.recipe.count();
}

/**
 * Calculate how similar two recipe titles are (0-1, where 1 is identical)
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2); // Remove short words like "and", "the"

  const words1 = normalize(title1);
  const words2 = normalize(title2);

  if (words1.length === 0 || words2.length === 0) return 0;

  // Count matching words
  const matches = words1.filter((w) => words2.includes(w)).length;
  const maxLength = Math.max(words1.length, words2.length);

  return matches / maxLength;
}

/**
 * Calculate ingredient overlap between two recipes (0-1, where 1 is all ingredients match)
 */
function calculateIngredientOverlapPercent(
  ingredients1: Array<{ name: string; canonicalId?: string }>,
  ingredients2: Array<{ name: string; canonicalId?: string }>
): number {
  if (ingredients1.length === 0 || ingredients2.length === 0) return 0;

  // Use canonical IDs if available, otherwise normalize names
  const getKey = (ing: { name: string; canonicalId?: string }) =>
    ing.canonicalId || ing.name.toLowerCase().replace(/[^a-z0-9]/g, "");

  const set1 = new Set(ingredients1.map(getKey));
  const set2 = new Set(ingredients2.map(getKey));

  const intersection = [...set1].filter((x) => set2.has(x)).length;
  const maxLength = Math.max(set1.size, set2.size);

  return intersection / maxLength;
}

/**
 * Select diverse recipes from candidates
 * Avoids selecting recipes that are too similar to each other
 */
export function selectDiverseRecipes(
  candidates: RecipeWithSimilarity[],
  count: number,
  options: {
    titleSimilarityThreshold?: number;
    ingredientOverlapThreshold?: number;
  } = {}
): RecipeWithSimilarity[] {
  const {
    titleSimilarityThreshold = 0.6, // 60% word overlap
    ingredientOverlapThreshold = 0.7, // 70% ingredient overlap
  } = options;

  if (candidates.length === 0) return [];
  if (candidates.length <= count) return candidates;

  const selected: RecipeWithSimilarity[] = [];
  const candidatesCopy = [...candidates].sort(
    (a, b) => b.similarity - a.similarity
  );

  for (const candidate of candidatesCopy) {
    if (selected.length >= count) break;

    // Check if this recipe is too similar to any already-selected recipe
    let isTooSimilar = false;

    for (const selectedRecipe of selected) {
      // Check title similarity
      const titleSim = calculateTitleSimilarity(
        candidate.title,
        selectedRecipe.title
      );

      if (titleSim >= titleSimilarityThreshold) {
        console.log(
          `  ⊘ Skipping "${candidate.title}" - too similar to "${
            selectedRecipe.title
          }" (${(titleSim * 100).toFixed(0)}% title match)`
        );
        isTooSimilar = true;
        break;
      }

      // Check ingredient overlap
      const candidateIngredients = candidate.ingredients as Array<{
        name: string;
        canonicalId?: string;
      }>;
      const selectedIngredients = selectedRecipe.ingredients as Array<{
        name: string;
        canonicalId?: string;
      }>;

      if (candidateIngredients && selectedIngredients) {
        const overlap = calculateIngredientOverlapPercent(
          candidateIngredients,
          selectedIngredients
        );

        if (overlap >= ingredientOverlapThreshold) {
          console.log(
            `  ⊘ Skipping "${candidate.title}" - too similar to "${
              selectedRecipe.title
            }" (${(overlap * 100).toFixed(0)}% ingredient overlap)`
          );
          isTooSimilar = true;
          break;
        }
      }
    }

    if (!isTooSimilar) {
      selected.push(candidate);
    }
  }

  // If we couldn't get enough diverse recipes, fill with remaining candidates
  if (selected.length < count) {
    console.log(
      `  ℹ️  Only found ${selected.length} diverse recipes, adding ${
        count - selected.length
      } more...`
    );
    for (const candidate of candidatesCopy) {
      if (selected.length >= count) break;
      if (!selected.find((s) => s.id === candidate.id)) {
        selected.push(candidate);
      }
    }
  }

  return selected;
}

/**
 * Search recipes by tags and cuisine preferences
 * Fallback when embedding search fails
 */
export async function searchRecipesByTags(
  cuisinePreferences: Array<{ cuisine: string; level: string }>,
  options: {
    limit?: number;
    excludeRecipeIds?: string[];
  } = {}
): Promise<RecipeWithSimilarity[]> {
  const { limit = 50, excludeRecipeIds = [] } = options;

  // Get loved and liked cuisines
  const lovedCuisines = cuisinePreferences
    .filter((c) => c.level === "LOVE")
    .map((c) => c.cuisine.toLowerCase().replace(/_/g, " "));

  const likedCuisines = cuisinePreferences
    .filter((c) => c.level === "LIKE")
    .map((c) => c.cuisine.toLowerCase().replace(/_/g, " "));

  const allCuisines = [...lovedCuisines, ...likedCuisines];

  if (allCuisines.length === 0) {
    return [];
  }

  // Build tag search condition
  const tagConditions = allCuisines
    .map((cuisine) => `tags::text ILIKE '%${cuisine}%'`)
    .join(" OR ");

  const excludeCondition =
    excludeRecipeIds.length > 0
      ? `AND id NOT IN (${excludeRecipeIds.map((id) => `'${id}'`).join(",")})`
      : "";

  const query = `
    SELECT 
      id,
      "userId",
      title,
      description,
      servings,
      "totalMinutes",
      tags,
      ingredients,
      steps,
      source,
      "createdAt",
      "updatedAt",
      0.8 as similarity
    FROM "Recipe"
    WHERE (${tagConditions})
    ${excludeCondition}
    ORDER BY "createdAt" DESC
    LIMIT $1
  `;

  const recipes = await prisma.$queryRawUnsafe<RecipeWithSimilarity[]>(
    query,
    limit
  );

  return recipes;
}

/**
 * Get random recipes from the database
 * Last resort when no other search methods work
 */
export async function getRandomRecipes(
  count: number,
  options: {
    excludeRecipeIds?: string[];
  } = {}
): Promise<RecipeWithSimilarity[]> {
  const { excludeRecipeIds = [] } = options;

  const excludeCondition =
    excludeRecipeIds.length > 0
      ? `WHERE id NOT IN (${excludeRecipeIds.map((id) => `'${id}'`).join(",")})`
      : "";

  const query = `
    SELECT 
      id,
      "userId",
      title,
      description,
      servings,
      "totalMinutes",
      tags,
      ingredients,
      steps,
      source,
      "createdAt",
      "updatedAt",
      0.5 as similarity
    FROM "Recipe"
    ${excludeCondition}
    ORDER BY RANDOM()
    LIMIT $1
  `;

  const recipes = await prisma.$queryRawUnsafe<RecipeWithSimilarity[]>(
    query,
    count
  );

  return recipes;
}

/**
 * Search for a single recipe by text query
 */
export async function searchRecipeByQuery(
  query: string,
  options: {
    limit?: number;
    excludeRecipeIds?: string[];
    minSimilarity?: number;
  } = {}
): Promise<RecipeWithSimilarity[]> {
  const { limit = 10, excludeRecipeIds = [], minSimilarity = 0.6 } = options;

  // For single recipe search, we generate embedding directly from the query
  const { generateEmbedding } = await import("./embedding-utils");
  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = embeddingToPostgresVector(queryEmbedding);

  // Build WHERE conditions
  const conditions: string[] = ["embedding IS NOT NULL"];
  const params: any[] = [vectorStr];
  let paramIndex = 2;

  if (excludeRecipeIds.length > 0) {
    conditions.push(
      `id NOT IN (${excludeRecipeIds.map(() => `$${paramIndex++}`).join(",")})`
    );
    params.push(...excludeRecipeIds);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const query_sql = `
    SELECT 
      id,
      "userId",
      title,
      description,
      servings,
      "totalMinutes",
      tags,
      ingredients,
      steps,
      source,
      "createdAt",
      "updatedAt",
      1 - (embedding <=> $1::vector) as similarity
    FROM "Recipe"
    ${whereClause}
    ORDER BY embedding <=> $1::vector
    LIMIT $${paramIndex}
  `;

  params.push(limit);

  const recipes = await prisma.$queryRawUnsafe<RecipeWithSimilarity[]>(
    query_sql,
    ...params
  );

  return recipes.filter((r) => r.similarity >= minSimilarity);
}

/**
 * Dietary restriction keywords for filtering
 */
const MEAT_KEYWORDS = [
  "chicken",
  "beef",
  "pork",
  "lamb",
  "turkey",
  "duck",
  "veal",
  "bacon",
  "sausage",
  "ham",
  "steak",
  "ground meat",
  "meatball",
  "meat",
  "poultry",
  "prosciutto",
  "salami",
  "pepperoni",
  "chorizo",
];

const DAIRY_KEYWORDS = [
  "milk",
  "cheese",
  "butter",
  "cream",
  "yogurt",
  "whey",
  "casein",
  "lactose",
  "parmesan",
  "cheddar",
  "mozzarella",
  "ricotta",
  "feta",
  "goat cheese",
  "sour cream",
  "half and half",
];

const FISH_KEYWORDS = [
  "fish",
  "salmon",
  "tuna",
  "cod",
  "shrimp",
  "crab",
  "lobster",
  "shellfish",
  "seafood",
  "anchovy",
  "tilapia",
  "halibut",
  "trout",
  "mahi mahi",
  "catfish",
  "clam",
  "mussel",
  "oyster",
  "scallop",
  "calamari",
  "squid",
];

const EGG_KEYWORDS = ["egg", "eggs", "mayonnaise", "mayo"];

const HONEY_KEYWORDS = ["honey"];

/**
 * Check if text contains any of the specified keywords
 */
function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

/**
 * Check if a recipe meets dietary restrictions
 */
export function doesRecipeMeetDietaryRestrictions(
  recipe: { ingredients?: unknown; tags?: unknown },
  preferences: {
    dietStyle?: string;
    allergies?: string[];
    exclusions?: string[];
  }
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ingredients = (recipe.ingredients as any[]) || [];
  const ingredientText = ingredients
    .map((ing) => `${ing.name || ""} ${ing.notes || ""}`)
    .join(" ")
    .toLowerCase();

  // Check diet style
  if (preferences.dietStyle) {
    const style = preferences.dietStyle.toLowerCase();

    if (style === "vegan") {
      if (
        containsAny(ingredientText, [
          ...MEAT_KEYWORDS,
          ...DAIRY_KEYWORDS,
          ...FISH_KEYWORDS,
          ...EGG_KEYWORDS,
          ...HONEY_KEYWORDS,
        ])
      ) {
        return false;
      }
    } else if (style === "vegetarian") {
      if (containsAny(ingredientText, [...MEAT_KEYWORDS, ...FISH_KEYWORDS])) {
        return false;
      }
    } else if (style === "pescatarian") {
      if (containsAny(ingredientText, MEAT_KEYWORDS)) {
        return false;
      }
    }
    // Add more diet styles as needed
  }

  // Check allergies
  if (preferences.allergies && preferences.allergies.length > 0) {
    for (const allergen of preferences.allergies) {
      if (ingredientText.includes(allergen.toLowerCase())) {
        return false;
      }
    }
  }

  // Check exclusions
  if (preferences.exclusions && preferences.exclusions.length > 0) {
    for (const exclusion of preferences.exclusions) {
      if (ingredientText.includes(exclusion.toLowerCase())) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if user has any dietary restrictions
 */
export function hasDietaryRestrictions(preferences: {
  dietStyle?: string;
  allergies?: string[];
  exclusions?: string[];
}): boolean {
  return !!(
    preferences.dietStyle ||
    (preferences.allergies && preferences.allergies.length > 0) ||
    (preferences.exclusions && preferences.exclusions.length > 0)
  );
}
