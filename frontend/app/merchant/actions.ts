"use server";

import { redirect } from "next/navigation";
import { getBaseUrl } from "@/lib/api";
import { getAuthToken } from "@/lib/dal";
import { LOGIN_MARKER } from "@/lib/constants";

/** Starts the Facebook page connect flow and sends the browser to consent; the API brings it back to /merchant/settings. */
export async function connectFacebookAction() {
  const token = await getAuthToken();
  const res = await fetch(`${getBaseUrl()}/merchants/me/connect/facebook`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (res?.status === 401) redirect(`/login?${LOGIN_MARKER}=1`);
  const body = res?.ok ? ((await res.json()) as { auth_url?: string; connected?: string }) : null;
  if (body?.auth_url) redirect(body.auth_url);
  redirect(`/merchant/settings?${body?.connected ? `connected=${body.connected}` : "error=connect_failed"}`);
}
