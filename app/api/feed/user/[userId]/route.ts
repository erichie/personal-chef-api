import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getUserActivity } from "@/lib/feed-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { userId } = await params;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor") || undefined;

    const result = await getUserActivity(userId, user.id, {
      limit,
      cursor,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
