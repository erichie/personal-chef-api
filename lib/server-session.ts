import { headers, cookies } from "next/headers";
import { auth } from "./auth";

export async function getServerSession() {
  const headerList = await headers();
  const cookieStore = await cookies();

  const plainHeaders: Record<string, string> = {};
  headerList.forEach((value, key) => {
    plainHeaders[key] = value;
  });

  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");

  if (cookieHeader) {
    plainHeaders.cookie = cookieHeader;
  }

  try {
    const session = await auth.api.getSession({
      headers: plainHeaders,
    });

    if (!session?.user) {
      return null;
    }

    return session;
  } catch (error) {
    console.log("[getServerSession] error:", error);
    return null;
  }
}

export async function requireServerSession() {
  const session = await getServerSession();

  if (!session) {
    throw new Error("AUTH_REQUIRED");
  }

  return session;
}

