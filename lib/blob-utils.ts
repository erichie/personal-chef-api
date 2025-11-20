const ALLOWED_BLOB_HOST_SUFFIXES = [".vercel-storage.com", "vercel-storage.com"];

export function isAllowedBlobUrl(url?: string | null): boolean {
  if (!url) {
    return true;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      return false;
    }

    return ALLOWED_BLOB_HOST_SUFFIXES.some((suffix) =>
      parsed.hostname === suffix ? true : parsed.hostname.endsWith(suffix)
    );
  } catch {
    return false;
  }
}

