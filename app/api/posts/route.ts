import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { createPost } from "@/lib/post-utils";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

const createPostSchema = z.object({
  recipeId: z.string().optional(),
  recipe: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      servings: z.number().optional(),
      totalMinutes: z.number().optional(),
      tags: z.array(z.string()).optional(),
      ingredients: z.array(z.any()),
      steps: z.array(z.any()).optional(),
      source: z.string().optional(),
      sourceUrl: z.string().url().optional(),
    })
    .optional(),
  text: z.string().optional(),
  photoUrl: z.string().url().optional(),
  rating: z.number().min(1).max(5).optional(),
  review: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const data = createPostSchema.parse(body);

    // Validate that either recipeId or recipe is provided
    if (!data.recipeId && !data.recipe) {
      return NextResponse.json(
        { error: "Either recipeId or recipe must be provided" },
        { status: 400 }
      );
    }

    let recipeId = data.recipeId;

    // If recipe object is provided, create or find the recipe
    if (data.recipe) {
      console.log("📝 Create Post - Creating recipe:", data.recipe.title);

      // Check if recipe already exists by title
      const existingRecipe = await prisma.recipe.findFirst({
        where: {
          userId: user.id,
          title: data.recipe.title,
        },
      });

      if (existingRecipe) {
        console.log("📝 Found existing recipe:", existingRecipe.id);
        recipeId = existingRecipe.id;
      } else {
        // Create new recipe
        const newRecipeId = uuidv4();
        const newRecipe = await prisma.recipe.create({
          data: {
            id: newRecipeId,
            userId: user.id,
            title: data.recipe.title,
            description: data.recipe.description || null,
            servings: data.recipe.servings || null,
            totalMinutes: data.recipe.totalMinutes || null,
            tags: (data.recipe.tags || null) as any,
            ingredients: data.recipe.ingredients as any,
            steps: (data.recipe.steps || null) as any,
            source: data.recipe.source || "user-post",
            sourceUrl: data.recipe.sourceUrl || null,
          },
        });
        recipeId = newRecipe.id;
        console.log("📝 Created new recipe:", recipeId);
      }
    } else if (recipeId) {
      // Verify the recipe exists and belongs to the user
      const recipe = await prisma.recipe.findUnique({
        where: { id: recipeId },
      });

      if (!recipe) {
        return NextResponse.json(
          { error: "Recipe not found" },
          { status: 404 }
        );
      }

      if (recipe.userId !== user.id) {
        return NextResponse.json(
          { error: "Recipe does not belong to this user" },
          { status: 403 }
        );
      }

      console.log("📝 Create Post - Using existing recipe ID:", recipeId);
    }

    // Log the data
    console.log("📝 Create Post - Recipe ID:", recipeId);
    console.log("📝 Create Post - User ID:", user.id);
    console.log("📝 Create Post - Post data:", {
      text: data.text,
      rating: data.rating,
      hasPhoto: !!data.photoUrl,
    });

    const post = await createPost({
      userId: user.id,
      recipeId: recipeId!,
      text: data.text,
      photoUrl: data.photoUrl,
      rating: data.rating,
      review: data.review,
    });

    console.log("✅ Post created successfully:", post.id);

    return NextResponse.json({ post });
  } catch (error) {
    console.error("❌ Create Post Error:", error);
    return handleApiError(error);
  }
}
