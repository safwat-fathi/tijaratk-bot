"use server";

import { getAuthToken } from "@/lib/dal";
import { getBaseUrl } from "@/lib/api";

export async function verifyFacebookTokens() {
  try {
    const token = await getAuthToken();
    const res = await fetch(`${getBaseUrl()}/auth/me/verify-tokens`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (res.status === 401) {
      return { success: false, status: 401 };
    }

    if (!res.ok) {
      return { success: false, status: res.status };
    }

    return { success: true };
  } catch (error) {
    console.error("verifyFacebookTokens failed:", error);
    return { success: false, status: 500 };
  }
}
