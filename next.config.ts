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
        // 90 for the local landing-page photos, 80 for the Supabase-hosted stay images whose
        // sources are already WebP q80. 100 is deliberately gone: every source here is an
        // already-lossy JPEG, so q100 re-encodes its compression noise at full fidelity —
        // ~40% more bytes for detail that is not in the file to begin with.
        qualities: [75, 80, 90],

        // AVIF ships ~20% smaller than WebP at the same quality, so this buys quality PER
        // BYTE rather than trading it away. WebP is the fallback for browsers without AVIF
        // support; order matters, the first match against the Accept header wins.
        // Trade-off: the first request for each image encodes ~50% slower, and both variants
        // are cached separately.
        formats: ["image/avif", "image/webp"],

        // Default ladder jumps 2048 -> 3840. The hero is sized by HEIGHT (see hero.tsx), so on
        // a short or narrow window it paints wider than 100vw and lands on 3840 every time
        // with nothing in between. 2560 is that missing rung.
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3840],

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
    experimental: {
        optimizePackageImports: ["@phosphor-icons/react"],

        // Avatar uploads travel through a Server Action, and the default body cap is 1 MB —
        // small enough that an ordinary phone photo was rejected before uploadAvatar ever ran.
        // 4 MB, not more: Vercel caps a serverless request body at 4.5 MB, so a larger number
        // here would just move the same silent failure to a boundary we do not control.
        // MAX_UPLOAD_BYTES in features/auth/avatar-limits.ts sits a megabyte below this on
        // purpose — see the comment there.
        serverActions: { bodySizeLimit: "4mb" },
    },
};

export default nextConfig;
