import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_ONLY_PATHS = ["/login", "/signup"];

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("access_token");
  const { pathname } = request.nextUrl;

  if (hasSession && AUTH_ONLY_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: ["/login", "/signup"],
};
