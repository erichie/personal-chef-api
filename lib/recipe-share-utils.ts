import { prisma } from "./prisma";
import { errors } from "./api-errors";
import { getFriendIds } from "./friend-utils";
import type { RecipeShare } from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * Share a recipe directly to a friend
 * Can provide either recipeId (for existing recipe) or recipe object (to create if needed)
 */
export async function shareRecipeToFriend(data: {
  recipeId?: string;
  recipe?: {
    title: string;
    description?: string;
    servings?: number;
    totalMinutes?: number;
    cuisine?: string;
    tags?: string[];
    ingredients: any[];
    steps?: any[];
    source?: string;
  };
  senderId: string;
  recipientId: string;
  message?: string;
}): Promise<RecipeShare> {
  // Can't share with yourself
  if (data.senderId === data.recipientId) {
    throw errors.badRequest("Cannot share recipe with yourself");
  }

  // Validate that either recipeId or recipe is provided
  if (!data.recipeId && !data.recipe) {
    throw errors.badRequest("Either recipeId or recipe must be provided");
  }

  let recipeId = data.recipeId;

  // If recipe object is provided, create or find the recipe
  if (data.recipe) {
    console.log(
      "📝 Share Recipe - Creating/finding recipe:",
      data.recipe.title
    );

    // Check if recipe already exists by title
    const existingRecipe = await prisma.recipe.findFirst({
      where: {
        userId: data.senderId,
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
          userId: data.senderId,
          title: data.recipe.title,
          description: data.recipe.description || null,
          servings: data.recipe.servings || null,
          totalMinutes: data.recipe.totalMinutes || null,
          cuisine: data.recipe.cuisine || "Other",
          tags: (data.recipe.tags || null) as any,
          ingredients: data.recipe.ingredients as any,
          steps: (data.recipe.steps || null) as any,
          source: data.recipe.source || "user-shared",
        },
      });
      recipeId = newRecipe.id;
      console.log("📝 Created new recipe:", recipeId);
    }
  } else if (recipeId) {
    // Verify the recipe exists and belongs to sender
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      throw errors.notFound("Recipe not found");
    }

    if (recipe.userId !== data.senderId) {
      throw errors.forbidden("Cannot share a recipe you don't own");
    }

    console.log("📝 Share Recipe - Using existing recipe ID:", recipeId);
  }

  // At this point, recipeId must be defined
  if (!recipeId) {
    throw errors.badRequest("Failed to determine recipe ID");
  }

  // Verify they are friends
  const friendIds = await getFriendIds(data.senderId);
  if (!friendIds.includes(data.recipientId)) {
    throw errors.forbidden("Can only share recipes with friends");
  }

  // Check if already shared
  const existingShare = await prisma.recipeShare.findFirst({
    where: {
      recipeId: recipeId!,
      senderId: data.senderId,
      recipientId: data.recipientId,
    },
  });

  if (existingShare) {
    throw errors.badRequest("Already shared this recipe with this friend");
  }

  // Create share
  const share = await prisma.recipeShare.create({
    data: {
      id: uuidv4(),
      recipeId: recipeId!,
      senderId: data.senderId,
      recipientId: data.recipientId,
      message: data.message,
    },
    include: {
      sender: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          friendCode: true,
          bio: true,
        },
      },
      recipient: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          friendCode: true,
          bio: true,
        },
      },
      recipe: {
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          servings: true,
          totalMinutes: true,
          tags: true,
          ingredients: true,
          steps: true,
        },
      },
    },
  });

  return share as unknown as RecipeShare;
}

/**
 * Get recipes shared with a user
 */
export async function getSharedRecipes(
  userId: string,
  status?: "pending" | "viewed" | "saved" | "declined"
): Promise<RecipeShare[]> {
  const shares = await prisma.recipeShare.findMany({
    where: {
      recipientId: userId,
      ...(status && { status }),
    },
    include: {
      sender: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          friendCode: true,
          bio: true,
        },
      },
      recipe: {
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          servings: true,
          totalMinutes: true,
          tags: true,
          ingredients: true,
          steps: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return shares as unknown as RecipeShare[];
}

/**
 * Update the status of a recipe share
 */
export async function updateRecipeShareStatus(
  shareId: string,
  userId: string,
  status: "viewed" | "saved" | "declined"
): Promise<RecipeShare> {
  const share = await prisma.recipeShare.findUnique({
    where: { id: shareId },
  });

  if (!share) {
    throw errors.notFound("Share not found");
  }

  if (share.recipientId !== userId) {
    throw errors.forbidden("Cannot update this share");
  }

  const updated = await prisma.recipeShare.update({
    where: { id: shareId },
    data: { status },
    include: {
      sender: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          friendCode: true,
          bio: true,
        },
      },
      recipe: {
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          servings: true,
          totalMinutes: true,
          tags: true,
          ingredients: true,
          steps: true,
        },
      },
    },
  });

  return updated as unknown as RecipeShare;
}
