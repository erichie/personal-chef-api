import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { searchUsers } from "@/lib/friend-utils";

const searchSchema = z.object({
  query: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const { query } = searchSchema.parse(body);

    const users = await searchUsers(query, user.id);

    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}
