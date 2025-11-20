"use client";

import { put } from "@vercel/blob/client";

interface UploadTokenResponse {
  pathname: string;
  token: string;
  contentType: string;
}

export async function uploadImageToBlob(file: File) {
  const filename = file.name || "upload.jpg";
  const contentType = file.type || "application/octet-stream";

  const tokenResponse = await fetch("/api/upload/image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename,
      contentType,
      size: file.size,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.json().catch(() => null);
    throw new Error(error?.error || "Failed to get upload token");
  }

  const { pathname, token }: UploadTokenResponse = await tokenResponse.json();

  const result = await put(pathname, file, {
    access: "public",
    token,
    contentType,
  });

  return result.url;
}

