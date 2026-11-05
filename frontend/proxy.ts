import { type NextRequest, NextResponse } from "next/server";
import { COOKIES, SESSION_COOKIES } from "@/lib/constants";
import { middleware as i18nMiddleware } from "@/lib/i18n";

const WEEK = 60 * 60 * 24 * 7;

/** Open mode: the API signs in its single owner merchant for whoever holds the server-side OPEN_ACCESS_KEY (this server). */
async function mintToken(): Promise<string | null> {
  const key = process.env.OPEN_ACCESS_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${process.env.BASE_API_URL}/auth/open`, { method: "POST", headers: { "x-open-key": key }, cache: "no-store" });
    return res.ok ? ((await res.json()) as { access_token: string }).access_token : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // There is no login screen. /login only resets the session (expired sessions are sent here), then re-enters below.
  if (pathname.startsWith("/login")) {
    const response = NextResponse.redirect(new URL("/merchant", request.url));
    for (const key of SESSION_COOKIES) response.cookies.delete(key);
    return response;
  }

  if (pathname.startsWith("/merchant") && !request.cookies.get(COOKIES.TOKEN)) {
    const token = await mintToken();
    if (!token) {
      return new NextResponse("Cannot open the app: OPEN_ACCESS_KEY must be set here and match the API's, and the API must be running.", { status: 503 });
    }
    const response = NextResponse.redirect(request.url); // same page again, now with the session cookie
    response.cookies.set(COOKIES.TOKEN, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: WEEK });
    return response;
  }

  return i18nMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
