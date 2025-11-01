import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { upsertVote, removeVote } from "@/lib/recipe-utils";
import { VoteType } from "@prisma/client";
import { z } from "zod";
import { errors } from "@/lib/api-errors";

const VoteRequestSchema = z.object({
  voteType: z.enum(["upvote", "downvote"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  try {
    const { recipeId } = await params;
    const auth = await getOptionalAuth(request);

    if (!auth?.user?.id) {
      throw errors.unauthorized("Must be logged in to vote");
    }

    const body = await request.json();
    const { voteType } = VoteRequestSchema.parse(body);

    console.log("🗳️  Vote Recipe - Recipe ID:", recipeId);
    console.log("🗳️  Vote Recipe - User ID:", auth.user.id);
    console.log("🗳️  Vote Recipe - Vote Type:", voteType);

    const result = await upsertVote(
      recipeId,
      auth.user.id,
      voteType as VoteType
    );

    console.log("✅ Vote recorded:", result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ Vote Recipe Error:", error);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  try {
    const { recipeId } = await params;
    const auth = await getOptionalAuth(request);

    if (!auth?.user?.id) {
      throw errors.unauthorized("Must be logged in to remove vote");
    }

    console.log("🗑️  Remove Vote - Recipe ID:", recipeId);
    console.log("🗑️  Remove Vote - User ID:", auth.user.id);

    const result = await removeVote(recipeId, auth.user.id);

    console.log("✅ Vote removed:", result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ Remove Vote Error:", error);
    return handleApiError(error);
  }
}
