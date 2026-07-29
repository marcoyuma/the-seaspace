import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    images: { qualities: [75, 80, 100] },
    experimental: { optimizePackageImports: ["@phosphor-icons/react"] },
};

export default nextConfig;
