import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

import {
    supabase,
    publicStorageUrl,
    BOOKINGS_CACHE_TAG,
    BOOKINGS_CACHE_PROFILE,
} from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";
import { getAuthUser } from "@/features/auth/actions";
import { looksLikeAccessCode } from "@/features/booking/lib/access-code";
import type { CheckInMethodId } from "@/features/booking/lib/check-in-methods";
import type { PaymentMethodId } from "@/features/booking/lib/payment-methods";
import type {
    BookedRange,
    BookingStatus,
    CheckInInvite,
    GuestBooking,
} from "@/features/booking/types";

/**
 * Data access for this feature. Same convention as features/stays/actions.ts: read helpers
 * for Server Components, no `"use server"`. The write path is in server-actions.ts.
 *
 * Two different clients appear below, and the split is the security boundary:
 *
 * - **Availability** uses the anonymous client and `use cache`. It reads nothing
 *   guest-specific — two dates per booking, via an RPC — so one visitor's response is
 *   safe to serve to the next.
 * - **A guest's own bookings** use the session-bound server client and are **never
 *   cached**. The rows carry prices, notes and a guest uuid; a cache entry here would be
 *   one person's reservations handed to whoever asked next.
 */

// Shape PostgREST returns for the RPC. Hand-written, like the stays row types — the
// project has no `supabase gen types` step. A Postgres `date` arrives as a plain
// `yyyy-mm-dd` string, which is exactly the format the picker works in, so there is
// nothing to parse here.
interface BookedRangeRow {
    start_date: string;
    end_date: string;
}

/**
 * The dates already taken at one villa, from today onward.
 *
 * Goes through the `get_stay_booked_ranges` RPC rather than selecting from `bookings`:
 * the table is closed to `anon` by design (supabase/migrations/0009_bookings.sql), and
 * the function's return type is the column allow-list. See 0010_stay_availability.sql.
 *
 * Cached for minutes, not the catalogue's hours — a stale calendar offers dates that are
 * gone. Tagged per slug as well as globally so a future revalidation can clear one villa.
 *
 * ⚠️ `end` is exclusive. See BookedRange.
 *
 * @param slug - The stay's `slug`, which is also `Stay.id` in features/stays/types.ts.
 *
 * @example
 * const ranges = await getStayBookedRanges("coastal-arch-retreat");
 * // [{ start: "2026-08-18", end: "2026-08-21" }, …]
 */
export async function getStayBookedRanges(slug: string): Promise<BookedRange[]> {
    "use cache";
    cacheTag(BOOKINGS_CACHE_TAG, `${BOOKINGS_CACHE_TAG}:${slug}`);
    cacheLife(BOOKINGS_CACHE_PROFILE);

    const { data, error } = await supabase.rpc("get_stay_booked_ranges", {
        p_slug: slug,
    });

    if (error) {
        // Thrown, not swallowed into an empty array, for the same reason
        // features/stays/actions.ts throws: an empty calendar renders as a legitimate
        // "everything is free" page, which here would take bookings for dates that are
        // already occupied. A visible error is the safer failure.
        throw new Error(
            `Failed to load availability for stay "${slug}" from Supabase: ${error.message}`,
            { cause: error },
        );
    }

    return (data as BookedRangeRow[]).map((row) => ({
        start: row.start_date,
        end: row.end_date,
    }));
}

// ---------------------------------------------------------------------------
// The guest's own reservations
// ---------------------------------------------------------------------------

// Same bucket name as features/stays/actions.ts. Repeated rather than imported because
// that constant is private to the stays feature and this is the only other reader.
const STAYS_BUCKET = "stays";

/**
 * One round-trip for a trip card: the booking, the villa it is for, and that villa's
 * cover photo. PostgREST assembles the embed server-side.
 *
 * `stays` and `stay_images` are readable by `authenticated` (0001), so the embed needs no
 * new policy — and the booking rows themselves are still scoped by "guests read their own
 * bookings", which is what makes selecting without a `.eq("guest_id", …)` safe here.
 */
const GUEST_BOOKING_SELECT = `
    id, start_date, end_date, num_nights, num_guests,
    unit_price_per_night, discount_per_night, total_price,
    status, paid_at, created_at, guest_notes,
    check_in_method, access_code, payment_method, payment_reference,
    stays ( slug, name, location,
            stay_images ( storage_path, alt, blur_data_url, sort_order ) )
`;

interface GuestBookingRow {
    id: number;
    start_date: string;
    end_date: string;
    num_nights: number;
    num_guests: number;
    unit_price_per_night: number;
    discount_per_night: number;
    total_price: number;
    status: BookingStatus;
    paid_at: string | null;
    created_at: string;
    guest_notes: string | null;
    // All four are null on the 140 seeded rows, which predate arrival methods and the
    // payment record entirely. See supabase/migrations/0012.
    check_in_method: CheckInMethodId | null;
    access_code: string | null;
    payment_method: PaymentMethodId | null;
    payment_reference: string | null;
    // Non-null: bookings.stay_id is NOT NULL with `on delete restrict`, so the villa
    // behind a booking cannot disappear.
    stays: {
        slug: string;
        name: string;
        location: string;
        stay_images: {
            storage_path: string;
            alt: string;
            blur_data_url: string | null;
            sort_order: number;
        }[];
    };
}

function toGuestBooking(row: GuestBookingRow): GuestBooking {
    // sort_order 0 is the cover, the same convention the catalogue uses.
    const cover = row.stays.stay_images.find((image) => image.sort_order === 0);

    return {
        id: row.id,
        staySlug: row.stays.slug,
        stayName: row.stays.name,
        stayLocation: row.stays.location,
        image: cover
            ? {
                  src: publicStorageUrl(STAYS_BUCKET, cover.storage_path),
                  alt: cover.alt,
                  blurDataURL: cover.blur_data_url ?? undefined,
              }
            : null,
        checkIn: row.start_date,
        checkOut: row.end_date,
        nights: row.num_nights,
        numGuests: row.num_guests,
        pricePerNight: row.unit_price_per_night,
        discountPerNight: row.discount_per_night,
        totalPrice: row.total_price,
        status: row.status,
        paidAt: row.paid_at,
        createdAt: row.created_at,
        guestNotes: row.guest_notes,
        checkInMethod: row.check_in_method,
        accessCode: row.access_code,
        paymentMethod: row.payment_method,
        paymentReference: row.payment_reference,
    };
}

/**
 * Every reservation belonging to whoever is signed in, newest stay first.
 *
 * Returns `[]` for a signed-out visitor rather than throwing: `bookings` has no `anon`
 * policy, so the query legitimately succeeds with no rows, and "empty" is the honest
 * answer to "what are *your* bookings" when there is no you.
 *
 * ⚠️ No `use cache`, ever. See the note at the top of this file.
 */
export const getGuestBookings = cache(async (): Promise<GuestBooking[]> => {
    const user = await getAuthUser();
    if (!user) return [];

    const supabaseWithSession = await createClient();
    const { data, error } = await supabaseWithSession
        .from("bookings")
        .select(GUEST_BOOKING_SELECT)
        // Hits bookings_guest_id_idx (guest_id, start_date desc) — the index 0009 added
        // for exactly this list.
        .order("start_date", { ascending: false });

    if (error) {
        throw new Error(`Failed to load your bookings from Supabase: ${error.message}`, {
            cause: error,
        });
    }

    return (data as unknown as GuestBookingRow[]).map(toGuestBooking);
});

/**
 * One reservation, or `null` if it is not this guest's.
 *
 * There is no ownership check written here and none belongs here: the RLS policy scopes
 * the statement to `auth.uid() = guest_id`, so somebody else's booking id simply returns
 * no rows — indistinguishable from an id that does not exist, which is what stops this
 * page becoming a way to probe for other people's bookings.
 *
 * @param bookingId From the URL, so it may be anything at all.
 */
export async function getGuestBooking(bookingId: number): Promise<GuestBooking | null> {
    const user = await getAuthUser();
    if (!user) return null;

    const supabaseWithSession = await createClient();
    const { data, error } = await supabaseWithSession
        .from("bookings")
        .select(GUEST_BOOKING_SELECT)
        .eq("id", bookingId)
        .maybeSingle();

    if (error || !data) return null;

    return toGuestBooking(data as unknown as GuestBookingRow);
}

// ---------------------------------------------------------------------------
// The door
// ---------------------------------------------------------------------------

interface CheckInInviteRow {
    stay_name: string;
    stay_location: string;
    start_date: string;
    end_date: string;
    already_checked_in: boolean;
}

/**
 * What a scanned access code resolves to, or `null` if it opens nothing.
 *
 * Goes through the `get_check_in_invite` RPC, whose **return type is the allow-list** —
 * the same doctrine as `getStayBookedRanges()` above, and for a stronger reason: this one
 * is callable by `anon`, because whoever is standing at the door may not be signed in.
 * Villa, dates, and whether check-in already happened. Nothing else exists to leak.
 *
 * `null` covers every failure the same way — an unknown code, a cancelled booking, a stay
 * that is already over — because the page turns all of them into the same 404. Telling a
 * stranger which of those it was would be telling them their guess was close.
 *
 * ⚠️ No `use cache`, ever. A cached invite would keep saying "not checked in yet" after
 * somebody had walked in.
 *
 * @param code Straight from the URL, so it may be anything at all.
 */
export async function getCheckInInvite(code: string): Promise<CheckInInvite | null> {
    // Saves a round trip on `/checkin/hello`. Not a security check — the database decides
    // what a code opens.
    if (!looksLikeAccessCode(code)) return null;

    // The anonymous client on purpose: this read must work with no session, and it must
    // not accidentally run as whoever happens to be signed in on the device.
    const { data, error } = await supabase.rpc("get_check_in_invite", {
        p_code: code.trim().toUpperCase(),
    });

    if (error) {
        console.error(`[booking:invite] code=${error.code} ${error.message}`);
        return null;
    }

    const rows = data as CheckInInviteRow[];
    if (rows.length === 0) return null;

    const invite = rows[0];
    return {
        stayName: invite.stay_name,
        stayLocation: invite.stay_location,
        checkIn: invite.start_date,
        checkOut: invite.end_date,
        alreadyCheckedIn: invite.already_checked_in,
    };
}
