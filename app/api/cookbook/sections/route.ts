import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import {
  createCookbookSection,
  listCookbookSections,
} from "@/lib/cookbook-utils";

const createSectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const sections = await listCookbookSections(user.id);
    return NextResponse.json({ sections });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const data = createSectionSchema.parse(body);
    const section = await createCookbookSection(user.id, data);
    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

