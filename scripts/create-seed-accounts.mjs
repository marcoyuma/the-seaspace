/**
 * Creates one Supabase Auth account per distinct author in public.reviews.
 *
 *     node --env-file=.env.local scripts/create-seed-accounts.mjs
 *
 * Run it BETWEEN migrations 0006 and 0007. 0006 creates public.guests and the
 * trigger; this script creates the accounts, which makes the trigger fill
 * public.guests; 0007 then backfills reviews.guest_id and drops reviews.guest_ref.
 * Running 0007 first fails loudly rather than leaving orphaned reviews.
 *
 * `.mjs`, not `.mts`: the repo has no tsx/ts-node, and plain ESM runs under
 * `node --env-file` with nothing to install — the same shape as the RLS probes
 * in supabase/README.md.
 *
 * Idempotent: an address that already exists is reported as skipped, not as an
 * error, so re-running is safe.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_ACCOUNT_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PASSWORD) {
    console.error(
        "Missing env. Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY " +
            "and SEED_ACCOUNT_PASSWORD.\n" +
            "Run with: node --env-file=.env.local scripts/create-seed-accounts.mjs",
    );
    process.exit(1);
}

// Service role, and deliberately NOT lib/supabase.ts: that client uses the anon
// key (which cannot reach auth.admin at all) and forces every request through
// `next: { revalidate: 3600 }`, which has no meaning outside a Next render and
// would cache admin calls.
const admin = createClient(new URL(SUPABASE_URL).origin, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * `amara-lindqvist` → `amara.lindqvist@example.com`.
 *
 * example.com is reserved by RFC 2606, so these addresses can never send or
 * receive real mail. The derivation must stay deterministic: migration 0007
 * reproduces it in SQL to backfill reviews.guest_id, and any change here
 * silently breaks that join.
 */
function emailFor(guestRef) {
    return `${guestRef.replaceAll("-", ".")}@example.com`;
}

/**
 * The 62 distinct authors, read from the database rather than retyped.
 *
 * Retyping the list would create a second source of truth that drifts from
 * supabase/seed/0002_reviews_seed.sql the first time either is edited.
 */
async function readAuthors() {
    const { data, error } = await admin
        .from("reviews")
        .select("guest_ref, author_display_name, author_nationality");

    if (error) {
        if (error.message.includes("guest_ref")) {
            throw new Error(
                "reviews.guest_ref no longer exists — migration 0007 has already run, " +
                    "so the accounts were created in an earlier pass. Nothing to do.",
                { cause: error },
            );
        }
        throw new Error(`Failed to read reviews: ${error.message}`, {
            cause: error,
        });
    }

    // One entry per author. A Map keyed on guest_ref collapses the 100 review
    // rows down to the 62 people who wrote them.
    const authors = new Map();
    for (const row of data) {
        if (!authors.has(row.guest_ref)) {
            authors.set(row.guest_ref, {
                guestRef: row.guest_ref,
                displayName: row.author_display_name,
                nationality: row.author_nationality,
            });
        }
    }
    return [...authors.values()].sort((a, b) =>
        a.guestRef.localeCompare(b.guestRef),
    );
}

const authors = await readAuthors();
console.log(`Found ${authors.length} distinct authors in public.reviews.\n`);

let created = 0;
let skipped = 0;
const failures = [];

// Sequential rather than Promise.all: Supabase rate-limits the auth admin
// endpoints, and 62 accounts is not worth risking a partial run over.
for (const author of authors) {
    const email = emailFor(author.guestRef);

    const { error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        // Stamps email_confirmed_at, which is what the on_auth_guest_confirmed
        // trigger keys on. Without it no public.guests row is ever created.
        email_confirm: true,
        // The trigger reads these to populate guests.display_name and
        // guests.nationality — the same shape a real signup form would send.
        user_metadata: {
            display_name: author.displayName,
            nationality: author.nationality,
        },
    });

    if (!error) {
        created += 1;
        console.log(`  created  ${email}`);
        continue;
    }

    // Duplicate address is the expected outcome of a re-run, not a failure.
    const isDuplicate =
        error.code === "email_exists" ||
        /already been registered|already exists/i.test(error.message);

    if (isDuplicate) {
        skipped += 1;
        console.log(`  skipped  ${email} (already exists)`);
    } else {
        failures.push({ email, message: error.message });
        console.error(`  FAILED   ${email} — ${error.message}`);
    }
}

const { count: guestCount, error: countError } = await admin
    .from("guests")
    .select("*", { count: "exact", head: true });

console.log(
    `\ncreated: ${created}   skipped: ${skipped}   failed: ${failures.length}`,
);
console.log(
    `public.guests now holds ${
        countError ? `? (${countError.message})` : guestCount
    } rows — written by the trigger, never by this script.`,
);

if (failures.length > 0) {
    console.error("\nDo not run migration 0007 until these are resolved.");
    process.exit(1);
}
