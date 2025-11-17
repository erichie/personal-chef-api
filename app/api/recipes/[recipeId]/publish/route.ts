import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { publishRecipe, unpublishRecipe } from "@/lib/recipe-publication";

const publishSchema = z.object({
  slug: z.string().min(3).max(64).optional(),
  excerpt: z.string().max(280).optional(),
  shareImageUrl: z.string().url().optional(),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(180).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { recipeId } = await params;
    const body = await request.json();
    const data = publishSchema.parse(body);

    const publication = await publishRecipe({
      recipeId,
      userId: user.id,
      slug: data.slug,
      excerpt: data.excerpt,
      shareImageUrl: data.shareImageUrl,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
    });

    return NextResponse.json({ publication });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { recipeId } = await params;
    await unpublishRecipe({ recipeId, userId: user.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

