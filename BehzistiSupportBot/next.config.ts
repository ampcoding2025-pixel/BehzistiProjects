import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@microsoft/copilot-sdk", "koffi"],
};

export default nextConfig;
