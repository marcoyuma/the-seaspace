import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS and is the only one that can call `auth.admin.*`. Import ONLY
 * from server-only code — SUPABASE_SERVICE_ROLE_KEY has no `NEXT_PUBLIC_` prefix on purpose.
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
 * Builds a fresh admin client. Not a singleton, to match the request-scoped clients elsewhere —
 * though with `persistSession: false` there's no session to leak either way.
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
