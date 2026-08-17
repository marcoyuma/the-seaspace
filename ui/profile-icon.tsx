import Link from "next/link";
import Image from "next/image";
import { SignInIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { getGuestProfile } from "@/features/auth/actions";
import { publicStorageUrl } from "@/lib/supabase";

// One size for all three states, so the header's layout never shifts as the session
// resolves behind the Suspense boundary.
const SIZE = 38;

// `/dist/ssr` rather than the package root: these render inside Server Components, and it is
// the specifier `optimizePackageImports` in next.config.ts matches on.
const ICON_PROPS = { size: SIZE, color: "#000000", weight: "fill" } as const;

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
        <Link
            href="/login"
            aria-label="Sign in"
            className="flex items-center gap-4 z-10"
        >
            <SignInIcon {...ICON_PROPS} />
        </Link>
    );
}

/**
 * The header's account control, in one of three states:
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
        <Link
            href="/account"
            aria-label={`Account — ${profile.displayName}`}
            className="flex items-center gap-4 z-10"
        >
            {profile.avatarPath ? (
                <Image
                    // Bucket-relative path, never a stored URL — moving project or region
                    // stays an env change. remotePatterns in next.config.ts already covers
                    // /storage/v1/object/public/**, so the `guests` bucket needs no config.
                    src={publicStorageUrl("guests", profile.avatarPath)}
                    alt=""
                    width={SIZE}
                    height={SIZE}
                    // Decorative: the link's aria-label already names the person, so an alt
                    // here would have a screen reader announce the same thing twice.
                    aria-hidden
                    className="rounded-full object-cover"
                    style={{ width: SIZE, height: SIZE }}
                />
            ) : (
                <UserCircleIcon {...ICON_PROPS} />
            )}
        </Link>
    );
}
