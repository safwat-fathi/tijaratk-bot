import type { NextRequest } from "next/server";
import { COOKIES, SESSION_COOKIES } from "@/lib/constants";
import { middleware as i18nMiddleware } from "@/lib/i18n";

import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIES.TOKEN);
  const { pathname, searchParams } = request.nextUrl;

  // Invalid/expired session marker: clear session cookies on the way to /login.
  if (pathname.startsWith("/login") && searchParams.has("expired")) {
    const response = i18nMiddleware(request);
    for (const key of SESSION_COOKIES) {
      response.cookies.delete(key);
    }
    return response;
  }

  if (pathname.startsWith("/merchant")) {
    if (!token) {
      const url = new URL("/login", request.url);
      const response = NextResponse.redirect(url);
      return response;
    }
  }

  if (pathname.startsWith("/login")) {
    if (token) {
      return NextResponse.redirect(new URL("/merchant", request.url));
    }
  }

  return i18nMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
