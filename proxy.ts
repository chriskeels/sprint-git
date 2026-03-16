import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/auth/login", "/auth/register"];

/**
 * Lightweight JWT check for the Edge runtime.
 * We only decode and check expiry here — full signature verification
 * is done server-side in getSession() / verifyToken() inside API routes
 * and server components (which run in Node.js, not Edge).
 */
function hasValidToken(request: NextRequest): boolean {
  const token = request.cookies.get("stackup_token")?.value;
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    // base64url → base64 → JSON
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(padded));
    // Reject if expired
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false;
    // Must have a userId claim
    if (!payload.userId) return false;
    return true;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  if (!hasValidToken(request)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};