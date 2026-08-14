import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Data fetching is excluded from prerenders unless explicitly cached with `use cache`.
    // Enabled so the header can read the session in a Server Component: without this flag a
    // `cookies()` call anywhere in the tree makes the WHOLE route dynamic, which would kill
    // generateStaticParams() on /stays/[stayId]. With it, <Suspense> is a real boundary —
    // the fallback ships in the static shell and only the session streams at request time.
    // Top-level, not `experimental`: the experimental variants (ppr, dynamicIO,
    // experimental.cacheComponents) are deprecated in favour of this single flag.
    cacheComponents: true,

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
