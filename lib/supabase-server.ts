import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Session-aware client for Server Components, Server Actions and proxy.ts. Never the same object
 * as lib/supabase.ts's anonymous singleton — this one carries a specific person's cookies.
 */

// Static property access, not process.env[name] — Next only inlines NEXT_PUBLIC_* when it
// can see the literal key at build time. Same reasoning as lib/supabase.ts.
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
 * Builds a request-scoped client bound to the caller's cookies.
 *
 * Not a module-level singleton: `cookies()` differs per request, so a shared instance would
 * hand one visitor's session to the next.
 *
 * @example
 * const supabase = await createClient();
 * const { data } = await supabase.auth.getClaims();
 */
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(SUPABASE_ORIGIN, ANON_KEY, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                // Server Components can't write cookies, yet supabase-js calls this on token
                // rotation. Swallowing is the documented pattern: proxy.ts refreshes and writes them.
                try {
                    for (const { name, value, options } of cookiesToSet) {
                        cookieStore.set(name, value, options);
                    }
                } catch {
                    // Called from a Server Component — proxy.ts already handled it.
                }
            },
        },
    });
}
