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
 * Booking reads (writes: server-actions.ts). Availability: anon client + `use cache` — only two dates
 * per booking, via an RPC. A guest's own bookings: session client, **never cached** — the rows carry
 * prices, notes and a guest uuid, so a cache entry would hand them to the next visitor.
 */

// PostgREST's shape for the RPC (hand-written; no `supabase gen types`). A Postgres `date` arrives
// as the `yyyy-mm-dd` string the picker already uses, so nothing needs parsing.
interface BookedRangeRow {
    start_date: string;
    end_date: string;
}

/**
 * Dates already taken at one villa from today, via `get_stay_booked_ranges` — `bookings` is closed
 * to `anon`, and the RPC's return type is the column allow-list (0010). Cached minutes, not hours,
 * and tagged per slug too. ⚠️ `end` is exclusive — see BookedRange.
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
        // Thrown, not swallowed: an empty calendar reads as "everything is free" and would take
        // bookings for occupied dates. A visible error is the safer failure.
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
 * One round-trip per trip card: booking + villa + cover, embedded by PostgREST. `stays` and
 * `stay_images` are readable by `authenticated` (0001), and RLS "guests read their own bookings"
 * scopes the rows — which is why no `.eq("guest_id", …)` is needed.
 */
const GUEST_BOOKING_SELECT = `
    id, start_date, end_date, num_nights, num_guests,
    unit_price_per_night, discount_per_night, total_price,
    status, paid_at, created_at, guest_notes,
    cancelled_at, refund_reference,
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
    // Both null unless the guest cancelled it themselves — see 0019's constraints.
    cancelled_at: string | null;
    refund_reference: string | null;
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
        cancelledAt: row.cancelled_at,
        refundReference: row.refund_reference,
        checkInMethod: row.check_in_method,
        accessCode: row.access_code,
        paymentMethod: row.payment_method,
        paymentReference: row.payment_reference,
    };
}

/**
 * The signed-in guest's reservations, newest stay first. `[]` when signed out — `bookings` has no
 * `anon` policy, so the query legitimately returns nothing. ⚠️ No `use cache`, ever (see file top).
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
 * One reservation, or `null` if it isn't this guest's. No ownership check needed: RLS scopes to
 * `auth.uid() = guest_id`, so another guest's id looks nonexistent — no probing for bookings.
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
 * What a scanned access code resolves to, or `null` — every failure alike, so a 404 tells a stranger
 * nothing. `get_check_in_invite` is `anon`-callable (whoever is at the door may be signed out), so
 * its return type is the allow-list. ⚠️ Never cached: it must reflect a fresh check-in.
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
