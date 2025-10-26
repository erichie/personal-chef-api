import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { addComment } from "@/lib/post-utils";

const commentSchema = z.object({
  text: z.string().min(1).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = params;
    const body = await request.json();
    const { text } = commentSchema.parse(body);

    const comment = await addComment(postId, user.id, text);

    return NextResponse.json({ comment });
  } catch (error) {
    return handleApiError(error);
  }
}
