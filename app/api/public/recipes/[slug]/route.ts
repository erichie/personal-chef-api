import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getPublicRecipeBySlug } from "@/lib/recipe-publication";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await getOptionalAuth(request);
    const payload = await getPublicRecipeBySlug(slug, auth?.user?.id);
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}

