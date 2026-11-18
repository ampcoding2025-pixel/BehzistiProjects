import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native ODBC driver must load from node_modules, not the webpack bundle.
  serverExternalPackages: ["msnodesqlv8", "mssql"],
};

export default nextConfig;
