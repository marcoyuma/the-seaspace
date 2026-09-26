import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Lets the header read the session inside <Suspense> without one `cookies()` making the whole
    // route dynamic (killing generateStaticParams on /stays/[stayId]); uncached fetches leave the
    // prerender. Top-level: ppr, dynamicIO and experimental.cacheComponents are deprecated.
    cacheComponents: true,

    /* config options here */
    images: {
        // 90 for local landing photos, 80 for Supabase stay images (already WebP q80). No 100:
        // every source is already lossy, so q100 spends ~40% more bytes re-encoding noise.
        qualities: [75, 80, 90],

        // AVIF is ~20% smaller than WebP at equal quality; WebP is the fallback (first Accept match
        // wins). Trade-off: each image's first request encodes ~50% slower, and both are cached.
        formats: ["image/avif", "image/webp"],

        // Default ladder jumps 2048 -> 3840. The hero is sized by HEIGHT (see hero.tsx), so on
        // a short or narrow window it paints wider than 100vw and lands on 3840 every time
        // with nothing in between. 2560 is that missing rung.
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3840],

        // Villa photos from Supabase Storage; without this the optimizer 400s them. Not Supabase's
        // `loader`: it's global (would hijack public/ assets) and needs paid Image Transformations.
        remotePatterns: [
            new URL(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/**`,
            ),
        ],
    },
    experimental: {
        optimizePackageImports: ["@phosphor-icons/react"],

        // Avatar uploads go through a Server Action; the 1 MB default rejected phone photos. No more
        // than 4 MB, as Vercel caps bodies at 4.5 MB. MAX_UPLOAD_BYTES (avatar-limits.ts) sits 1 MB below.
        serverActions: { bodySizeLimit: "4mb" },
    },
};

export default nextConfig;
