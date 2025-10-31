import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

const createRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  servings: z.number().positive().optional(),
  totalMinutes: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
  ingredients: z.array(z.any()).min(1),
  steps: z.array(z.any()).optional(),
  source: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const data = createRecipeSchema.parse(body);

    console.log("🍳 Create Recipe - Title:", data.title);
    console.log("🍳 Create Recipe - User ID:", user.id);
    console.log("🍳 Create Recipe - Source:", data.source || "manual");
    console.log("🍳 Create Recipe - Source URL:", data.sourceUrl || "none");

    // Create the recipe
    const recipe = await prisma.recipe.create({
      data: {
        userId: user.id,
        title: data.title,
        description: data.description || null,
        servings: data.servings || null,
        totalMinutes: data.totalMinutes || null,
        tags: (data.tags || null) as any,
        ingredients: data.ingredients as any,
        steps: (data.steps || null) as any,
        source: data.source || "manual",
        sourceUrl: data.sourceUrl || null,
      },
    });

    console.log("✅ Recipe created successfully:", recipe.id);

    return NextResponse.json({ recipe }, { status: 201 });
  } catch (error) {
    console.error("❌ Create Recipe Error:", error);
    return handleApiError(error);
  }
}
