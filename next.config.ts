import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configure output for better compatibility
  output: 'standalone',
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
