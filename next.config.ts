import type { NextConfig } from "next";

// next-pwa ainda usa require em muitos setups, então mantemos assim.
const runtimeCaching = require("next-pwa/cache");

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Next.js 16 usa Turbopack por padrão no build.
  // Como você está buildando com `--webpack` (por causa do next-pwa),
  // isso evita o erro "Turbopack + webpack config".
  turbopack: {},
};

export default withPWA(nextConfig);