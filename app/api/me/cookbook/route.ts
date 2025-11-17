import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { ensureCookbookSlug } from "@/lib/cookbook-utils";

const updateSlugSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and dashes"),
});

function getBaseUrl(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (host) {
    return `${proto}://${host}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const baseUrl = getBaseUrl(request);
    const shareUrl = user.cookbookSlug
      ? `${baseUrl}/cookbook/${user.cookbookSlug}`
      : null;

    return NextResponse.json({
      cookbookSlug: user.cookbookSlug,
      shareUrl,
      displayName: user.displayName,
      bio: user.bio,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const data = updateSlugSchema.parse(body);
    const updated = await ensureCookbookSlug(user.id, data.slug);
    const baseUrl = getBaseUrl(request);
    return NextResponse.json({
      cookbookSlug: updated.cookbookSlug,
      shareUrl: updated.cookbookSlug
        ? `${baseUrl}/cookbook/${updated.cookbookSlug}`
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

