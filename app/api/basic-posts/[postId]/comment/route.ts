import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { addBasicPostComment } from "@/lib/basic-post-utils";

const commentSchema = z.object({
  text: z.string().min(1).max(1000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = await params;
    const body = await request.json();
    const data = commentSchema.parse(body);

    const comment = await addBasicPostComment(postId, user.id, data.text.trim());

    return NextResponse.json({ comment });
  } catch (error) {
    return handleApiError(error);
  }
}

