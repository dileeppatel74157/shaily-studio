import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@shaily/ui", "@shaily/shared", "@shaily/core"],
};

export default nextConfig;
