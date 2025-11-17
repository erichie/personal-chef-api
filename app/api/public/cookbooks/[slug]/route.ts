import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-errors";
import { getPublicCookbookBySlug } from "@/lib/cookbook-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { user, publications } = await getPublicCookbookBySlug(slug);

    const recipes = publications.map((publication) => ({
      slug: publication.slug,
      publishedAt: publication.publishedAt,
      excerpt: publication.excerpt,
      shareImageUrl: publication.shareImageUrl,
      title: publication.recipe.title,
      description: publication.recipe.description,
      imageUrl: publication.recipe.imageUrl,
      tags: publication.recipe.tags,
      cuisine: publication.recipe.cuisine,
    }));

    return NextResponse.json({
      user,
      recipes,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

