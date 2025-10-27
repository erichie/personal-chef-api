import { pipeline, env } from "@xenova/transformers";

// Configure transformers to use local cache
env.allowLocalModels = false;
env.allowRemoteModels = true;

// Singleton pattern for the embedding pipeline
let embeddingPipeline: Awaited<ReturnType<typeof pipeline>> | null = null;

/**
 * Get or initialize the embedding pipeline
 * Uses all-MiniLM-L6-v2 model (384 dimensions, optimized for semantic similarity)
 */
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return embeddingPipeline;
}

/**
 * Generate embedding from text
 * Returns a 384-dimensional vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const pipe = await getEmbeddingPipeline();
  const output: any = await pipe(text, {
    pooling: "mean",
    normalize: true,
  } as any);

  // Convert tensor to array
  return Array.from(output.data as Float32Array);
}

/**
 * Generate embedding for a recipe
 * Combines title, description, tags, and ingredients for semantic richness
 */
export async function generateRecipeEmbedding(recipe: {
  title: string;
  description?: string | null;
  tags?: unknown;
  ingredients?: unknown;
}): Promise<number[]> {
  // Build a rich text representation of the recipe
  const parts: string[] = [recipe.title];

  if (recipe.description) {
    parts.push(recipe.description);
  }

  // Add tags if available
  if (recipe.tags && Array.isArray(recipe.tags)) {
    parts.push(recipe.tags.join(" "));
  }

  // Add ingredient names
  if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
    const ingredientNames = recipe.ingredients
      .map((ing: any) => ing.name || "")
      .filter((name: string) => name.length > 0)
      .join(", ");
    if (ingredientNames) {
      parts.push(ingredientNames);
    }
  }

  const recipeText = parts.join(". ");
  return generateEmbedding(recipeText);
}

/**
 * Generate embedding for user meal plan preferences
 * Converts preferences into a searchable text representation
 */
export async function generatePreferencesEmbedding(preferences: {
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
  preferencesExplanation?: string;
}): Promise<number[]> {
  const parts: string[] = [];

  // Prioritize concrete, recipe-matchable attributes over abstract goals

  // Add loved cuisines FIRST and MULTIPLE times for higher weight
  if (preferences.cuisinePreferences) {
    const lovedCuisines = preferences.cuisinePreferences
      .filter((c) => c.level === "LOVE")
      .map((c) => c.cuisine.toLowerCase().replace(/_/g, " "));

    if (lovedCuisines.length > 0) {
      // Add each cuisine individually for better matching
      lovedCuisines.forEach((cuisine) => {
        parts.push(`${cuisine} recipe`);
        parts.push(`${cuisine} dish`);
      });
    }

    const likedCuisines = preferences.cuisinePreferences
      .filter((c) => c.level === "LIKE")
      .map((c) => c.cuisine.toLowerCase().replace(/_/g, " "));
    if (likedCuisines.length > 0) {
      likedCuisines.forEach((cuisine) => {
        parts.push(`${cuisine} meal`);
      });
    }
  }

  // Add preferences explanation if available
  if (preferences.preferencesExplanation) {
    parts.push(preferences.preferencesExplanation);
  }

  // Add diet style in recipe context (skip omnivore as it's default)
  if (preferences.dietStyle && preferences.dietStyle !== "omnivore") {
    parts.push(`${preferences.dietStyle} recipe`);
  }

  // Skip abstract goals - they don't match recipe text well
  // Goals like "USE_WHAT_I_HAVE, TRY_NEW_RECIPES" don't appear in recipe descriptions

  // Add time preferences in recipe-like language
  if (preferences.maxDinnerMinutes && preferences.maxDinnerMinutes <= 45) {
    parts.push("quick dinner recipe");
    parts.push("easy meal");
  }

  // Note: We intentionally don't include allergies/exclusions in the embedding
  // These are hard filters that should be applied separately

  if (parts.length === 0) {
    // Fallback for empty preferences
    console.log(
      "⚠️  No preferences provided, using fallback: 'dinner recipe meal'"
    );
    return generateEmbedding("dinner recipe meal");
  }

  const preferencesText = parts.join(". ");
  console.log("🔍 Preference embedding text:", preferencesText);
  return generateEmbedding(preferencesText);
}

/**
 * Generate embedding for a recipe replacement request
 */
export async function generateReplacementEmbedding(params: {
  originalRecipe: {
    title: string;
    ingredients?: Array<{ name: string }>;
  };
  replacementReason: string;
  preferences?: {
    dietStyle?: string;
    cuisinePreferences?: Array<{
      cuisine: string;
      level: string;
    }>;
  };
}): Promise<number[]> {
  const parts: string[] = [];

  // The replacement reason is most important
  parts.push(params.replacementReason);

  // Add context about what we're replacing
  parts.push(`Alternative to ${params.originalRecipe.title}`);

  // Add preferences
  if (params.preferences?.dietStyle) {
    parts.push(`${params.preferences.dietStyle} diet`);
  }

  if (params.preferences?.cuisinePreferences) {
    const lovedCuisines = params.preferences.cuisinePreferences
      .filter((c) => c.level === "LOVE")
      .map((c) => c.cuisine.toLowerCase().replace(/_/g, " "));
    if (lovedCuisines.length > 0) {
      parts.push(`Prefers ${lovedCuisines.join(", ")} cuisine`);
    }
  }

  const replacementText = parts.join(". ");
  return generateEmbedding(replacementText);
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns a value between -1 and 1 (higher = more similar)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Convert embedding array to PostgreSQL vector format
 */
export function embeddingToPostgresVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Parse PostgreSQL vector string to embedding array
 */
export function postgresVectorToEmbedding(vector: string): number[] {
  // Remove brackets and split by comma
  const cleaned = vector.replace(/^\[|\]$/g, "");
  return cleaned.split(",").map((v) => parseFloat(v.trim()));
}
