import type { NextConfig } from "next";


import { paraglide } from "@inlang/paraglide-next/plugin";

import path from "path";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async rewrites() {
    return [
      {
        source: "/blog/:slug.md",
        destination: "/api/markdown/blog/:slug",
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      "$paraglide/runtime.js": "./paraglide/runtime.js",
    },
  },
};

const config = paraglide({
  paraglide: {
    project: "./project.inlang",
    outdir: "./paraglide",
  },
  ...nextConfig,
});

// paraglide-next adds a legacy `experimental.turbo` key that Next 16 rejects;
// `turbopack.resolveAlias` above already covers it.
delete (config.experimental as Record<string, unknown> | undefined)?.turbo;

export default config;
