"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBaseUrl } from "@/lib/api";
import { COOKIES, SESSION_COOKIES } from "@/lib/constants";

export async function loginWithKeyAction(formData: FormData) {
  const apiKey = String(formData.get("api_key") ?? "").trim();
  const res = await fetch(`${getBaseUrl()}/auth/key-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) redirect(`/login?error=${res?.status === 401 ? "invalid" : "unavailable"}`);

  const data = (await res.json()) as { access_token: string };
  const cookieStore = await cookies();
  cookieStore.set(COOKIES.TOKEN, data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week, same as the token
  });
  redirect("/merchant");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  for (const key of SESSION_COOKIES) {
    cookieStore.delete(key);
  }
  redirect("/login");
}
