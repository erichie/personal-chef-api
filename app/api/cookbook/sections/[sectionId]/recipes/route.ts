import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { modifySectionRecipes } from "@/lib/cookbook-utils";

const assignSchema = z.object({
  recipeIds: z.array(z.string()).min(1),
  action: z.enum(["add", "remove"]).default("add"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { sectionId } = await params;
    const body = await request.json();
    const data = assignSchema.parse(body);

    await modifySectionRecipes(user.id, sectionId, data.recipeIds, data.action);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

