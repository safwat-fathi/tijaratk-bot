"use client";

import { useEffect, useRef } from "react";
import { verifyFacebookTokens } from "@/app/merchant/actions";
import { useRouter } from "next/navigation";

export function TokenVerifier() {
  const verifiedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    // Only run once per mount.
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    async function checkTokens() {
      const result = await verifyFacebookTokens();
      if (result && result.status === 401) {
        // Token is revoked/expired, redirect to login to clear session.
        router.push("/login?expired=1");
      }
    }
    
    checkTokens();
  }, [router]);

  return null;
}
