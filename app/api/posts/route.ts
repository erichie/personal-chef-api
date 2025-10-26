import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { createPost } from "@/lib/post-utils";

const createPostSchema = z.object({
  recipeId: z.string(),
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

    const post = await createPost({
      userId: user.id,
      ...data,
    });

    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}
