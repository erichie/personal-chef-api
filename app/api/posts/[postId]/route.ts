import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getPostWithDetails, updatePost, deletePost } from "@/lib/post-utils";

const updatePostSchema = z.object({
  text: z.string().optional(),
  photoUrl: z.string().url().optional(),
  rating: z.number().min(1).max(5).optional(),
  review: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = params;

    const post = await getPostWithDetails(postId, user.id);

    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = params;
    const body = await request.json();

    const data = updatePostSchema.parse(body);
    const post = await updatePost(postId, user.id, data);

    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = params;

    await deletePost(postId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
