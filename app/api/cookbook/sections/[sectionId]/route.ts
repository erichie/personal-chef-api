import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import {
  updateCookbookSection,
  deleteCookbookSection,
} from "@/lib/cookbook-utils";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { sectionId } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    const section = await updateCookbookSection(user.id, sectionId, data);
    return NextResponse.json({ section });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const { user } = await requireAuth(request);
    const { sectionId } = await params;
    await deleteCookbookSection(user.id, sectionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

