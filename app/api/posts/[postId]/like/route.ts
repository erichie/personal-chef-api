import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { toggleLike } from "@/lib/post-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { postId } = await params;

    const result = await toggleLike(postId, user.id);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
