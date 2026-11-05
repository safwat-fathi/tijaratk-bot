"use client";

import Script from "next/script";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: {
      init: (params: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      login: (
        callback: (response: {
          authResponse?: { accessToken: string; userID?: string; expiresIn?: number; signedRequest?: string };
          status?: string;
        }) => void,
        params?: { scope: string; return_scopes?: boolean; config_id?: string }
      ) => void;
    };
  }
}

export function FacebookSDK() {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;

  if (!appId) {
    console.warn("NEXT_PUBLIC_META_APP_ID is not defined. Facebook Login will not work.");
    return null;
  }

  return (
    <Script
      id="facebook-jssdk"
      src="https://connect.facebook.net/en_US/sdk.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (!window.FB) return;
        window.FB.init({
          appId: appId,
          cookie: true,
          xfbml: true,
          version: "v20.0", // latest version
        });
      }}
    />
  );
}
