import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    const recipes = await prisma.recipe.findMany({
      where: { userId: user.id },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        publication: true,
      },
    });

    return NextResponse.json({ recipes });
  } catch (error) {
    return handleApiError(error);
  }
}

