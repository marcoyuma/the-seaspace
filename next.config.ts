import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    images: {
        qualities: [75, 80, 100],
        // Villa photos are served from Supabase Storage. Without this the optimizer rejects
        // them with a 400 rather than falling back, so every stays image would break.
        //
        // Deliberately NOT Supabase's custom `loader`/`loaderFile`: that setting is global,
        // so it would hijack every <Image> — including the assets still in public/ — and it
        // depends on Supabase Image Transformations, a paid feature. remotePatterns plus
        // Next's built-in optimizer is the correct pairing for a hybrid setup.
        remotePatterns: [
            new URL(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/**`,
            ),
        ],
    },
    experimental: { optimizePackageImports: ["@phosphor-icons/react"] },
};

export default nextConfig;
