import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones on the same Wi-Fi use the dev server (otherwise Next blocks its scripts
  // for non-localhost origins and buttons stop working). Dev-only; ignored in production.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
