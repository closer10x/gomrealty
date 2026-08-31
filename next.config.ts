import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ap.rdcpix.com" },
      { protocol: "https", hostname: "ar.rdcpix.com" },
      { protocol: "https", hostname: "*.rdcpix.com" },
    ],
  },
};

export default nextConfig;
