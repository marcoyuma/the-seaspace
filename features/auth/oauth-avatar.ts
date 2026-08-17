import type { User } from "@supabase/supabase-js";

import type { createClient } from "@/lib/supabase-server";

/**
 * Copies a GitHub or Google profile photo into the `guests` bucket, once.
 *
 * The providers hand back `avatar_url` as a full external URL, but `guests.avatar_path`
 * stores a bucket-relative path that `publicStorageUrl()` assembles at read time — the
 * convention `0008_guest_avatars.sql` is built on. Rather than add a second, differently
 * shaped column, the bytes are adopted into the bucket so every avatar in the app has one
 * origin and one code path.
 *
 * Best-effort by design: every failure is swallowed. The worst outcome is a guest who gets
 * the `UserCircleIcon` placeholder until they upload a photo themselves, which is already
 * the supported state for everyone who signs up with a password.
 */

/**
 * Exactly the MIME types `0008_guest_avatars.sql` puts on the bucket, mapped to the
 * extension stored in the path. A type outside this list would be rejected by Storage
 * anyway, so it is cheaper to stop before the upload.
 *
 * Exported so the guest-initiated upload action (`uploadAvatar` in server-actions.ts) checks
 * against the same bucket limits instead of a second, driftable copy of these numbers.
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
 * Hosts whose bytes we are willing to fetch.
 *
 * This is a server making an outbound request to a URL that arrived with a user, which is
 * the shape of an SSRF. The URL is read from `identity_data` rather than `user_metadata`
 * (see below), and this list is the second lock: without it a redirect chain or a changed
 * provider response could still point the fetch at an internal address.
 *
 * Leading dots matter — `evil-googleusercontent.com` does not end with
 * `.googleusercontent.com`.
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
 * The avatar URL the provider supplied, or `null`.
 *
 * Read from `identities[].identity_data`, **never** from `user.user_metadata`. Metadata is
 * writable by the account holder through `updateUser({ data })`, so taking the URL from
 * there would let anyone with an account choose what address this server fetches.
 * `identity_data` is written by Supabase from the provider's response and is not user
 * editable.
 */
function providerAvatarUrl(user: User): string | null {
    for (const identity of user.identities ?? []) {
        const url = identity.identity_data?.avatar_url;
        if (typeof url === "string" && isAllowedAvatarUrl(url)) return url;
    }

    return null;
}

/**
 * Gives a guest their provider photo if they do not have one yet.
 *
 * Safe to call on every OAuth sign-in: it returns early once `avatar_path` is set, so a
 * guest who later uploads their own photo never has it overwritten. This is adoption at
 * first sign-in, not an ongoing sync.
 *
 * Uses the guest's own session client, never the service role — the storage policy
 * `"guests upload their own avatar"` matches the first path segment against `auth.uid()`,
 * which is why the path starts with the user id.
 *
 * @param supabase Session-bound client, already carrying the freshly exchanged session.
 * @param user The signed-in user, as returned by `exchangeCodeForSession`.
 *
 * @example
 * after(() => adoptProviderAvatar(supabase, data.user));
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

        // EXIF is deliberately NOT stripped here, unlike the manual upload path specified in
        // features/account/README.md. These bytes never came from the guest's camera: the
        // provider re-encoded them, and the identical file is already public at the
        // provider's own URL, so copying it opens no exposure that did not exist. Stripping
        // would mean adding sharp as a dependency to re-encode an image that renders at 38px.
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
