import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the request is for a protected API route
  const protectedRoutes = ["/api/sync", "/api/ai"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check for authentication
  const deviceId = request.headers.get("X-Device-ID");
  const authToken = request.headers
    .get("Authorization")
    ?.replace("Bearer ", "");
  const cookieToken = request.cookies.get("better-auth.session_token")?.value;

  // Allow if any auth method is present
  // Actual validation happens in the API routes via requireAuth()
  if (!deviceId && !authToken && !cookieToken) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        code: "UNAUTHORIZED",
        message:
          "Authentication required. Provide X-Device-ID header or Authorization token.",
      },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/sync/:path*", "/api/ai/:path*"],
};
