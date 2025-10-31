import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import {
  getSharedRecipes,
  shareRecipeToFriend,
} from "@/lib/recipe-share-utils";

const ingredientSchema = z.object({
  qty: z.union([z.number(), z.string()]),
  name: z.string(),
  unit: z.string().optional(),
  notes: z.string().optional(),
  canonicalId: z.string().optional(),
});

const stepSchema = z.object({
  order: z.number(),
  text: z.string(),
});

const recipeSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  servings: z.number().optional(),
  totalMinutes: z.number().optional(),
  tags: z.array(z.string()).optional(),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema).optional(),
  source: z.string().optional(),
});

const shareRecipeSchema = z.object({
  recipeId: z.string().optional(),
  recipe: recipeSchema.optional(),
  recipientId: z.string(),
  message: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") as
      | "pending"
      | "viewed"
      | "saved"
      | "declined"
      | null;

    console.log("🔗 Get Shared Recipes - User ID:", user.id);
    console.log("🔗 Get Shared Recipes - Status Filter:", status || "all");

    const shares = await getSharedRecipes(user.id, status || undefined);

    console.log(`✅ Retrieved ${shares.length} shared recipes`);

    return NextResponse.json({ shares });
  } catch (error) {
    console.error("❌ Get Shared Recipes Error:", error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const data = shareRecipeSchema.parse(body);

    console.log("🔗 Share Recipe - Sender ID:", user.id);
    console.log("🔗 Share Recipe - Recipient ID:", data.recipientId);
    if (data.recipeId) {
      console.log("🔗 Share Recipe - Recipe ID:", data.recipeId);
    } else {
      console.log("🔗 Share Recipe - Recipe Title:", data.recipe?.title);
    }

    const share = await shareRecipeToFriend({
      recipeId: data.recipeId,
      recipe: data.recipe,
      senderId: user.id,
      recipientId: data.recipientId,
      message: data.message,
    });

    console.log("✅ Recipe shared successfully:", share.id);

    return NextResponse.json({ share });
  } catch (error) {
    console.error("❌ Share Recipe Error:", error);
    return handleApiError(error);
  }
}
