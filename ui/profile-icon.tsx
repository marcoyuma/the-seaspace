import Link from "next/link";
import Image from "next/image";
import { SignInIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { getGuestProfile } from "@/features/auth/actions";
import { publicStorageUrl } from "@/lib/supabase";

// Rendered inside the menu panel's account row, so it inherits that row's
// text size/weight and white color rather than fixing its own — unlike a
// standalone header icon, it now only ever appears in that one context.
const ICON_SIZE = 24;

// `next/image` 400s on widths outside `images.imageSizes`, so request the nearest valid size and
// scale down to `ICON_SIZE` via `style` — as `AvatarUpload` does at 96.
const AVATAR_IMAGE_SIZE = 32;

// `/dist/ssr` rather than the package root: these render inside Server Components, and it is
// the specifier `optimizePackageImports` in next.config.ts matches on.
const ICON_PROPS = { size: ICON_SIZE, weight: "fill" } as const;

/**
 * Session-loading placeholder, deliberately the signed-out state: the static shell commits before
 * it knows who's asking, and it's right for most visitors. Also app/layout.tsx's Suspense fallback.
 */
export function ProfileIconFallback() {
    return (
        <Link href="/login" className="flex items-center gap-3">
            <SignInIcon {...ICON_PROPS} aria-hidden />
            Sign in
        </Link>
    );
}

/**
 * Menu account row: signed out → `SignInIcon` to /login; signed in → avatar (or `UserCircleIcon`)
 * to /account. Reads cookies, so it must sit inside a <Suspense> (app/layout.tsx does this) or the
 * whole route falls out of the static shell.
 */
export default async function ProfileIcon() {
    const profile = await getGuestProfile();

    if (!profile) return <ProfileIconFallback />;

    return (
        <Link href="/account" className="flex items-center gap-3">
            {profile.avatarPath ? (
                <Image
                    // Bucket-relative path, never a stored URL — moving project or region
                    // stays an env change. remotePatterns in next.config.ts already covers
                    // /storage/v1/object/public/**, so the `guests` bucket needs no config.
                    src={publicStorageUrl("guests", profile.avatarPath)}
                    alt=""
                    width={AVATAR_IMAGE_SIZE}
                    height={AVATAR_IMAGE_SIZE}
                    // Decorative: the visible display name already names the person, so an
                    // alt here would have a screen reader announce the same thing twice.
                    aria-hidden
                    className="rounded-full object-cover"
                    style={{ width: ICON_SIZE, height: ICON_SIZE }}
                />
            ) : (
                <UserCircleIcon {...ICON_PROPS} aria-hidden />
            )}
            {profile.displayName}
        </Link>
    );
}
