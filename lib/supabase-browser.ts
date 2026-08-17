import { createBrowserClient } from "@supabase/ssr";

/**
 * Session-aware Supabase client for Client Components.
 *
 * Reads and writes the same cookies as lib/supabase-server.ts, so a session started here is
 * visible to Server Components on the next request and vice versa.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
            "Set both in .env.local for local dev and in the Vercel project settings for builds.",
    );
}

const SUPABASE_ORIGIN = new URL(SUPABASE_URL).origin;

// Re-bound after the guard above so the narrowing survives into the closure below:
// TypeScript does not carry a module-level `string | undefined` narrowing into a function body.
const ANON_KEY: string = SUPABASE_ANON_KEY;

/**
 * Browser client. Safe to call repeatedly — `createBrowserClient` returns the same instance
 * per set of arguments, so components need not share one through context.
 */
export function createClient() {
    return createBrowserClient(SUPABASE_ORIGIN, ANON_KEY);
}
