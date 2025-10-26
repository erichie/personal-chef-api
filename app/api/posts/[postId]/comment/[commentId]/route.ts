import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { deleteComment } from "@/lib/post-utils";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { commentId } = await params;

    await deleteComment(commentId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
