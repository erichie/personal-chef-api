import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

const requestSchema = z.object({
  filename: z.string().min(1, "filename is required"),
  contentType: z.string().min(1, "contentType is required"),
  size: z.number().int().positive().optional(),
});

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const json = await request.json();
    const { filename, contentType, size } = requestSchema.parse(json);

    if (size && size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds maximum size of 10MB" },
        { status: 413 }
      );
    }

    if (contentType && !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        {
          error: "Unsupported content type",
        },
        { status: 415 }
      );
    }

    const safeContentType = contentType || "application/octet-stream";
    const pathname = `user-uploads/${user.id}/${uuidv4()}-${filename}`;

    const token = await generateClientTokenFromReadWriteToken({
      pathname,
      maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
      allowedContentTypes: ALLOWED_CONTENT_TYPES,
      tokenPayload: JSON.stringify({
        userId: user.id,
        filename,
      }),
    });

    return NextResponse.json({
      pathname,
      token,
      contentType: safeContentType,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

