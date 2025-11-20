import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/api-errors";
import { saveExpoToken } from "@/lib/push-notifications";

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.string().optional(),
  deviceId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const data = registerSchema.parse(body);

    await saveExpoToken(user.id, data.token, {
      platform: data.platform,
      deviceId: data.deviceId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

