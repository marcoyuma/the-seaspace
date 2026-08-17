import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely and is the only client that can call
 * `auth.admin.*`.
 *
 * Import ONLY from server-only code — a `"use server"` file or a route handler. There is
 * deliberately no `NEXT_PUBLIC_` prefix on the key, unlike lib/supabase.ts and
 * lib/supabase-server.ts: it must never end up in a Client Component's bundle.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
            "Set both in .env.local for local dev and in the Vercel project settings for builds.",
    );
}

const SUPABASE_ORIGIN = new URL(SUPABASE_URL).origin;

// Re-bound after the guard above, same reasoning as lib/supabase-server.ts: TypeScript does
// not carry a module-level `string | undefined` narrowing into a function body.
const ADMIN_KEY: string = SERVICE_ROLE_KEY;

/**
 * Builds a fresh admin client.
 *
 * Not a module-level singleton, to match the request-scoped clients elsewhere — a shared
 * instance has no session state to leak here (`persistSession: false`), but building it
 * lazily keeps the pattern uniform and the throw above tied to first use rather than to
 * every route that merely imports this module.
 *
 * @example
 * const admin = createAdminClient();
 * await admin.auth.admin.deleteUser(userId);
 */
export function createAdminClient() {
    return createClient(SUPABASE_ORIGIN, ADMIN_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
