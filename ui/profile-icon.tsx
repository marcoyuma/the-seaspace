import Link from "next/link";
import Image from "next/image";
import { SignInIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { getGuestProfile } from "@/features/auth/actions";
import { publicStorageUrl } from "@/lib/supabase";

// Rendered inside the menu panel's account row, so it inherits that row's
// text size/weight and white color rather than fixing its own — unlike a
// standalone header icon, it now only ever appears in that one context.
const ICON_SIZE = 24;

// `next/image` rejects any `width` that isn't literally one of
// `next.config.ts`'s `images.imageSizes` (defaults to
// [32, 48, 64, 96, 128, 256, 384] — a 400, not a fallback) — so the avatar
// asks the optimizer for the nearest valid size and is then scaled back
// down to `ICON_SIZE` with an explicit `style`, same as `AvatarUpload` does
// at its own (valid) 96.
const AVATAR_IMAGE_SIZE = 32;

// `/dist/ssr` rather than the package root: these render inside Server Components, and it is
// the specifier `optimizePackageImports` in next.config.ts matches on.
const ICON_PROPS = { size: ICON_SIZE, weight: "fill" } as const;

/**
 * Placeholder shown while the session is still being read.
 *
 * Deliberately the signed-out state: it is what the static shell has to commit to before it
 * knows who is asking, and it is correct for every anonymous visitor — the majority.
 *
 * Exported so app/layout.tsx can use it as the <Suspense> fallback without duplicating it.
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
 * The menu panel's account row, in one of three states:
 *
 * 1. signed out — `SignInIcon`, linking to /login
 * 2. signed in without a photo — `UserCircleIcon` as a placeholder, linking to /account
 * 3. signed in with a photo — the avatar itself
 *
 * Async Server Component: it reads cookies, so it must be rendered inside a <Suspense>
 * boundary or the whole route falls out of the static shell. app/layout.tsx does that.
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
