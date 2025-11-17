import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-errors";
import {
  formatCookbookSections,
  getPublicCookbookBySlug,
} from "@/lib/cookbook-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { user, sections, publications } = await getPublicCookbookBySlug(slug);
    const { sections: sectionPayload, ungrouped } = formatCookbookSections(
      sections,
      publications
    );

    return NextResponse.json({
      user,
      sections: sectionPayload,
      ungrouped,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

