import type { NextConfig } from 'next';

// GitHub user-site repositories serve at the domain root.
const nextConfig: NextConfig = { output: "export", trailingSlash: false, images: { unoptimized: true } };

export default nextConfig;
