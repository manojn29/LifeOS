import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow accessing Next.js dev chunks & HMR over local network from mobile devices
  allowedDevOrigins: [
    '192.168.1.2',
    '192.168.1.2:3000',
    'localhost',
    'localhost:3000',
  ],
};

export default nextConfig;
