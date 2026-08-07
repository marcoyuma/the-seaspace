/**
 * One-shot migration script: move the 21 villa photos out of `public/villas/`
 * and into the Supabase `stays` bucket, recording everything the render layer
 * loses when it stops using static imports.
 *
 * A static `import villa1 from "@/public/..."` hands Next three things for
 * free: intrinsic width/height, an auto-generated blurDataURL, and a hashed
 * URL. A remote URL has none of them — so this script derives the first two at
 * upload time and writes them to `stay_images`. Doing it here rather than at
 * render time matters: generating blur on the server per request would mean
 * downloading the full-size image on every page view.
 *
 * The app never imports this file. Run it by hand:
 *
 *   pnpm stays:images -- --dry-run   # compress only, no network, prints sizes
 *   pnpm stays:images                # compress, upload, upsert rows
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY: the catalogue tables are read-only to
 * the anon key by design (see supabase/migrations/0001_stays_schema.sql).
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BUCKET = "stays";

// Squarely inside what the layout ever asks for, and small enough that the
// Next optimizer's own resizes stay cheap. Source files run up to 9 MB today.
const MAX_EDGE = 2560;
const WEBP_QUALITY = 80;

// 16px wide is the width Next uses for its own static-import placeholders.
const BLUR_WIDTH = 16;
const BLUR_QUALITY = 20;

const PUBLIC_VILLAS = join(process.cwd(), "public", "villas");

interface SourceImage {
    /** Path relative to public/villas/ */
    file: string;
    /** Copied verbatim from the gallery entries in features/stays/data.ts. */
    alt: string;
    /** Becomes the storage filename: `{sortOrder}-{role}.webp`. */
    role: string;
}

interface StayManifest {
    slug: string;
    /** Array order IS sort_order. Index 0 is also the grid/card cover image. */
    images: SourceImage[];
}

/**
 * Transcribed from the `gallery` arrays in features/stays/data.ts, in order.
 * Index 0 of each stay matches that stay's `imageSrc`, which is why no
 * separate cover column exists in the schema.
 */
const MANIFEST: StayManifest[] = [
    {
        slug: "tuscan-twilight-villa",
        images: [
            { file: "villa1/stay1.jpg", alt: "Villa exterior at dusk", role: "exterior" },
            { file: "villa1/stay1-br.jpg", alt: "Primary bedroom", role: "bedroom" },
            { file: "villa1/stay1-bat.jpg", alt: "Ensuite bathroom", role: "bathroom" },
            { file: "villa1/stay1-lr.jpg", alt: "Open living pavilion", role: "living-pavilion" },
            { file: "villa1/stay1-e.jpg", alt: "Garden and pool terrace", role: "pool-terrace" },
        ],
    },
    {
        slug: "coastal-arch-retreat",
        images: [
            { file: "villa4/luxury-holiday-home-2.jpg", alt: "Clifftop exterior", role: "exterior" },
            { file: "villa4/minimalist-bedroom-with-blue-accents.jpg", alt: "Bedroom with blue accents", role: "bedroom" },
            { file: "villa4/modern-minimalist-white-bathroom-design.jpg", alt: "Sculpted white bathroom", role: "bathroom" },
            { file: "villa4/contemporary-house-interior-design.jpg", alt: "Contemporary living room", role: "living-room" },
            { file: "villa4/minimalist-coastal-retreat-with-archway-ocean-view.jpg", alt: "Archway to the ocean view", role: "archway" },
            // ⚠️ This source file is ALSO imported by
            // features/spa/components/spa-relaxation-section.tsx. It must stay in
            // public/ even after public/villas/ is deleted — see supabase/README.md.
            { file: "villa4/minimalist-coastal-interior-with-arched-window-built-seating.jpg", alt: "Arched window with built-in seating", role: "window-seating" },
        ],
    },
    {
        slug: "riverside-stone-lodge",
        images: [
            { file: "villa2/stay2.jpg", alt: "Stone facade and entry", role: "exterior" },
            { file: "villa2/stay2-br.jpg", alt: "Upstairs bedroom", role: "bedroom" },
            { file: "villa2/stay2-bat.jpg", alt: "Stone bathroom", role: "bathroom" },
            { file: "villa2/stay2-lr.jpg", alt: "Double-height living room", role: "living-room" },
            { file: "villa2/stay2.2.jpg", alt: "Plunge pool and deck", role: "plunge-pool" },
        ],
    },
    {
        slug: "cliffside-ocean-villa",
        images: [
            { file: "villa3/stay3.jpg", alt: "Villa above the western cliffs", role: "exterior" },
            { file: "villa3/stay3-br.jpg", alt: "Ocean-facing bedroom", role: "bedroom" },
            { file: "villa3/stay3-bat.jpg", alt: "Open-air bathroom", role: "bathroom" },
            { file: "villa3/stay3-lr.jpg", alt: "Living room facing the strait", role: "living-room" },
            { file: "villa3/stay3-e.jpg", alt: "Pool terrace at golden hour", role: "pool-terrace" },
        ],
    },
];

interface ProcessedImage {
    staySlug: string;
    storagePath: string;
    alt: string;
    sortOrder: number;
    width: number;
    height: number;
    blurDataURL: string;
    body: Buffer;
    sourceBytes: number;
}

function kb(bytes: number): string {
    return `${(bytes / 1024).toFixed(0)} KB`;
}

/**
 * The dashboard exposes several URLs for one project, and the API Docs page in
 * particular offers the REST endpoint (`…/rest/v1/`). supabase-js wants the
 * bare origin and appends its own paths, so pasting the REST URL fails with
 * PGRST125 "Invalid path specified in request URL". Worth normalising rather
 * than just erroring: the next phase builds storage URLs from the same
 * variable, where a stray path segment breaks images silently instead.
 */
function projectOrigin(raw: string): string {
    const url = new URL(raw);
    if (url.pathname !== "/" && url.pathname !== "") {
        console.warn(
            `  note: dropped "${url.pathname}" from NEXT_PUBLIC_SUPABASE_URL — ` +
                `it should be the bare project origin, e.g. ${url.origin}\n`,
        );
    }
    return url.origin;
}

/** Resize + re-encode to WebP, and derive the blur placeholder from the same source. */
async function processImage(
    staySlug: string,
    image: SourceImage,
    sortOrder: number,
): Promise<ProcessedImage> {
    const absolute = join(PUBLIC_VILLAS, image.file);
    const original = await readFile(absolute);

    // .rotate() with no argument applies the EXIF orientation and then strips
    // it. Without this, a phone-shot portrait re-encodes sideways, because
    // WebP output drops the EXIF tag the browser was relying on.
    const resized = sharp(original).rotate().resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
    });

    const { data, info } = await resized
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });

    const blur = await sharp(original)
        .rotate()
        .resize({ width: BLUR_WIDTH })
        .webp({ quality: BLUR_QUALITY })
        .toBuffer();

    return {
        staySlug,
        storagePath: `${staySlug}/${sortOrder}-${image.role}.webp`,
        alt: image.alt,
        sortOrder,
        width: info.width,
        height: info.height,
        blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
        body: data,
        sourceBytes: original.byteLength,
    };
}

async function main(): Promise<void> {
    const dryRun = process.argv.includes("--dry-run");

    console.log(
        dryRun
            ? "DRY RUN — compressing only, nothing leaves this machine.\n"
            : "Compressing and uploading to Supabase.\n",
    );

    const processed: ProcessedImage[] = [];
    for (const stay of MANIFEST) {
        for (const [sortOrder, image] of stay.images.entries()) {
            processed.push(await processImage(stay.slug, image, sortOrder));
        }
    }

    const sourceTotal = processed.reduce((sum, p) => sum + p.sourceBytes, 0);
    const outputTotal = processed.reduce((sum, p) => sum + p.body.byteLength, 0);

    for (const p of processed) {
        console.log(
            `  ${p.storagePath.padEnd(52)} ${kb(p.sourceBytes).padStart(9)} → ` +
                `${kb(p.body.byteLength).padStart(8)}  ${p.width}×${p.height}`,
        );
    }
    console.log(
        `\n  ${processed.length} images: ${kb(sourceTotal)} → ${kb(outputTotal)} ` +
            `(${Math.round((1 - outputTotal / sourceTotal) * 100)}% smaller)\n`,
    );

    if (dryRun) {
        // Written outside the repo so a dry run never dirties git status.
        const outDir = join(tmpdir(), "seaspace-stays-preview");
        for (const p of processed) {
            const target = join(outDir, p.storagePath);
            await mkdir(join(target, ".."), { recursive: true });
            await writeFile(target, p.body);
        }
        console.log(`Preview WebP files written to ${outDir}`);
        console.log("Open a few, confirm quality, then re-run without --dry-run.");
        return;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
                "Run via `pnpm stays:images`, which loads .env.local.",
        );
    }

    const supabase = createClient(projectOrigin(url), serviceKey, {
        auth: { persistSession: false },
    });

    // Resolve slug → id once. The seed must have run first; a missing slug here
    // means 0001_stays_seed.sql was skipped.
    const { data: stayRows, error: stayError } = await supabase
        .from("stays")
        .select("id, slug");
    if (stayError) throw stayError;

    const stayIdBySlug = new Map<string, number>(
        (stayRows ?? []).map((row) => [row.slug as string, row.id as number]),
    );
    for (const stay of MANIFEST) {
        if (!stayIdBySlug.has(stay.slug)) {
            throw new Error(
                `No row in public.stays for slug "${stay.slug}". Run supabase/seed/0001_stays_seed.sql first.`,
            );
        }
    }

    for (const p of processed) {
        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(p.storagePath, p.body, {
                contentType: "image/webp",
                // A year: the path is stable, and a replaced photo is a rare,
                // deliberate act that can be cache-busted by hand.
                cacheControl: "31536000",
                upsert: true,
            });
        if (uploadError) throw uploadError;

        const { error: rowError } = await supabase.from("stay_images").upsert(
            {
                stay_id: stayIdBySlug.get(p.staySlug),
                storage_path: p.storagePath,
                alt: p.alt,
                blur_data_url: p.blurDataURL,
                width: p.width,
                height: p.height,
                sort_order: p.sortOrder,
            },
            { onConflict: "storage_path" },
        );
        if (rowError) throw rowError;

        console.log(`  uploaded  ${p.storagePath}`);
    }

    console.log(`\nDone. ${processed.length} images in bucket "${BUCKET}".`);
    console.log("Next: run the verification block in supabase/README.md.");
}

main().catch((error: unknown) => {
    console.error("\nFailed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
