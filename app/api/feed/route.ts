import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { getFriendsFeed } from "@/lib/feed-utils";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor") || undefined;
    const type = (searchParams.get("type") || "all") as
      | "all"
      | "posts"
      | "meals"
      | "saves";

    const result = await getFriendsFeed(user.id, {
      limit,
      cursor,
      type,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
