import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { createFeedActivity, getFriendsFeed } from "@/lib/feed-utils";
import { prisma } from "@/lib/prisma";
import { isAllowedBlobUrl } from "@/lib/blob-utils";

const createBasicPostSchema = z
  .object({
    text: z.string().trim().max(1000).optional(),
    photoUrl: z.string().url().optional(),
  })
  .refine(
    (data) => {
      const hasText = data.text && data.text.trim().length > 0;
      return hasText || !!data.photoUrl;
    },
    {
      message: "Provide text or photoUrl",
      path: ["text"],
    }
  );

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

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const parsed = createBasicPostSchema.parse(body);

    if (parsed.photoUrl && !isAllowedBlobUrl(parsed.photoUrl)) {
      return NextResponse.json(
        { error: "photoUrl must be a Vercel Blob URL" },
        { status: 400 }
      );
    }

    const text = parsed.text?.trim();
    const basicPost = await prisma.basicPost.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        text: text || null,
        photoUrl: parsed.photoUrl || null,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            friendCode: true,
            bio: true,
          },
        },
      },
    });

    await createFeedActivity({
      userId: user.id,
      activityType: "basic_post",
      basicPostId: basicPost.id,
    });

    const postWithMeta = {
      ...basicPost,
      likeCount: 0,
      commentCount: 0,
      isLikedByCurrentUser: false,
    };

    return NextResponse.json({ post: postWithMeta });
  } catch (error) {
    return handleApiError(error);
  }
}
