import type { User } from "@supabase/supabase-js";

import type { createClient } from "@/lib/supabase-server";

/**
 * Adopts a GitHub/Google profile photo into the `guests` bucket once, so every avatar is a
 * bucket-relative path (0008's convention) on one code path. Best-effort: failures are swallowed,
 * leaving the `UserCircleIcon` placeholder that password sign-ups already get.
 */

/**
 * The bucket's MIME types (0008) mapped to stored extensions; Storage would reject anything else,
 * so stop before uploading. Exported so `uploadAvatar` checks the same list, not a driftable copy.
 */
export const ACCEPTED_TYPES: Record<string, string> = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/avif": "avif",
};

/** The bucket's own `file_size_limit`, repeated here so we fail before the round-trip. */
export const MAX_BYTES = 512 * 1024;

const FETCH_TIMEOUT_MS = 5_000;

/**
 * Hosts we'll fetch avatars from — the second SSRF lock after reading `identity_data`, so redirects
 * or changed responses can't reach internal addresses. Leading dots matter:
 * `evil-googleusercontent.com` doesn't end with `.googleusercontent.com`.
 */
const ALLOWED_HOSTS = [".googleusercontent.com", ".githubusercontent.com"];

function isAllowedAvatarUrl(value: string): boolean {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return false;
        return ALLOWED_HOSTS.some((host) => url.hostname.endsWith(host));
    } catch {
        return false;
    }
}

/**
 * The provider's avatar URL, or `null` — from `identities[].identity_data` (written by Supabase),
 * **never** `user_metadata`, which the account holder can edit to aim this server's fetch.
 */
function providerAvatarUrl(user: User): string | null {
    for (const identity of user.identities ?? []) {
        const url = identity.identity_data?.avatar_url;
        if (typeof url === "string" && isAllowedAvatarUrl(url)) return url;
    }

    return null;
}

/**
 * Gives a guest their provider photo if they have none — adoption at first sign-in, never
 * overwriting a later upload. Uses the guest's session client, not the service role: the storage
 * policy matches the path's first segment (the user id) against `auth.uid()`.
 *
 * @param supabase Session-bound client, already carrying the freshly exchanged session.
 * @param user The signed-in user, as returned by `exchangeCodeForSession`.
 *
 * @example after(() => adoptProviderAvatar(supabase, data.user));
 */
export async function adoptProviderAvatar(
    supabase: Awaited<ReturnType<typeof createClient>>,
    user: User,
): Promise<void> {
    try {
        const avatarUrl = providerAvatarUrl(user);
        if (!avatarUrl) return;

        const { data: guest } = await supabase
            .from("guests")
            .select("avatar_path")
            .eq("id", user.id)
            .maybeSingle();

        // No row means the 0006 trigger has not run; a path means the guest already has a
        // photo. Neither is ours to overwrite.
        if (!guest || guest.avatar_path) return;

        const response = await fetch(avatarUrl, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!response.ok) return;

        const contentType =
            response.headers.get("content-type")?.split(";")[0].trim() ?? "";
        const extension = ACCEPTED_TYPES[contentType];
        if (!extension) return;

        const bytes = await response.arrayBuffer();
        if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return;

        // EXIF deliberately NOT stripped, unlike manual uploads: the provider already re-encoded
        // these bytes and the same file is public at its URL, so copying exposes nothing new.
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
            .from("guests")
            .upload(path, bytes, {
                contentType,
                // A replacement photo gets a new random filename, so a URL's contents can
                // never change — the CDN may hold it forever. Same reasoning as the path
                // convention documented in 0008_guest_avatars.sql.
                cacheControl: "31536000",
            });
        if (uploadError) return;

        await supabase
            .from("guests")
            .update({ avatar_path: path })
            .eq("id", user.id);
    } catch {
        // Deliberately silent. This runs after the response has been sent, so there is
        // nobody left to tell, and sign-in has already succeeded either way.
    }
}
