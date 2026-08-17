"use client";

// Client-side only for the submit lifecycle: `useActionState` supplies the pending flag
// while the simulated payment runs, and the failure message afterwards. The booking itself
// is written by a Server Action.
import { useActionState } from "react";

import { payAndBook } from "@/features/booking/server-actions";
import {
    DEFAULT_PAYMENT_METHOD,
    PAYMENT_METHODS,
} from "@/features/booking/lib/payment-methods";
import {
    CHECK_IN_METHODS,
    DEFAULT_CHECK_IN_METHOD,
} from "@/features/booking/lib/check-in-methods";
import type { GuestCounts } from "@/features/booking/types";
import { FormBanner, LABEL, INPUT } from "@/features/auth/components/form-primitives";

/**
 * One choice in a radio group, as a whole clickable card.
 *
 * The two groups on this page — how you pay, how you get in — are the same control with
 * different data, so they are the same component. `has-checked:` puts the selected border
 * on the label rather than needing state up here: the form is uncontrolled, and React
 * state for something the DOM already tracks is state that can disagree with it.
 */
function RadioCard({
    name,
    value,
    defaultChecked,
    label,
    note,
}: {
    name: string;
    value: string;
    defaultChecked: boolean;
    label: string;
    note: string;
}) {
    return (
        <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-black/10 p-5 transition-colors duration-300 ease-out motion-reduce:transition-none has-checked:border-black">
            <input
                type="radio"
                name={name}
                value={value}
                defaultChecked={defaultChecked}
                className="mt-1 size-4 accent-black"
            />
            <span>
                <span className="block text-[16px] font-medium text-black">
                    {label}
                </span>
                <span className="mt-1 block text-[16px] font-medium text-black/60">
                    {note}
                </span>
            </span>
        </label>
    );
}

/** The step headings, so the numbering cannot drift out of order. */
function Step({
    number,
    title,
    children,
}: {
    number: number;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-3xl border border-black/10 p-8">
            <h2 className="text-[20px] font-semibold text-black">
                <span className="text-black/40">{number}.</span> {title}
            </h2>
            <div className="mt-6">{children}</div>
        </section>
    );
}

/**
 * The left-hand column of the checkout page: how to pay, how to get in, what to tell the
 * villa team, and the button that writes the booking.
 *
 * Every value the action needs travels as a hidden input rather than as a closure over
 * props, because a Server Action is a public endpoint either way — a bound argument is no
 * safer than a form field, and hidden inputs keep it obvious that all of this is
 * re-validated on the server (`payAndBook`, then `create_booking`).
 *
 * ⚠️ There is no card number field, and there must never be one. See payment-methods.ts.
 *
 * @param slug The villa's `stays.slug`, also the `/stays/[stayId]` segment.
 * @param guests All four counters. Only `adults + children` reaches `num_guests`; infants
 *   and pets ride along so a resubmitted form and the URL agree.
 * @param disabledReason Set when the page has already decided this booking cannot proceed
 *   — the dates were taken while the guest sat here, for instance. Renders the form
 *   read-only rather than hiding it, so the guest can still see what they had chosen.
 */
export default function CheckoutForm({
    slug,
    checkIn,
    checkOut,
    guests,
    disabledReason,
}: {
    slug: string;
    checkIn: string;
    checkOut: string;
    guests: GuestCounts;
    disabledReason?: string;
}) {
    const [state, action, pending] = useActionState(payAndBook, undefined);
    const isBlocked = Boolean(disabledReason);

    return (
        <form action={action} className="flex flex-col gap-6">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="checkIn" value={checkIn} />
            <input type="hidden" name="checkOut" value={checkOut} />
            <input type="hidden" name="adults" value={guests.adults} />
            <input type="hidden" name="children" value={guests.children} />
            <input type="hidden" name="infants" value={guests.infants} />
            <input type="hidden" name="pets" value={guests.pets} />

            {(state?.message || disabledReason) && (
                <FormBanner message={disabledReason ?? state!.message} />
            )}

            <Step number={1} title="Choose how you'll pay">
                <fieldset disabled={isBlocked || pending}>
                    <legend className="sr-only">Payment method</legend>

                    <div className="flex flex-col gap-3">
                        {PAYMENT_METHODS.map((method) => (
                            <RadioCard
                                key={method.id}
                                name="method"
                                value={method.id}
                                defaultChecked={
                                    method.id === DEFAULT_PAYMENT_METHOD
                                }
                                label={method.label}
                                note={method.note}
                            />
                        ))}
                    </div>
                </fieldset>
            </Step>

            {/* Asked before the booking exists, not after, because "how do I get in" is
                something a guest wants settled before they pay — and because the answer
                is stored on the row itself (bookings.check_in_method). */}
            <Step number={2} title="Choose how you'll get in">
                <fieldset disabled={isBlocked || pending}>
                    <legend className="sr-only">Arrival method</legend>

                    <div className="flex flex-col gap-3">
                        {CHECK_IN_METHODS.map((method) => (
                            <RadioCard
                                key={method.id}
                                name="checkInMethod"
                                value={method.id}
                                defaultChecked={
                                    method.id === DEFAULT_CHECK_IN_METHOD
                                }
                                label={method.label}
                                note={method.note}
                            />
                        ))}
                    </div>
                </fieldset>

                {/* Worth saying out loud: the choice is about which door you prefer, not
                    which one you are allowed to use. One code opens both. */}
                <p className="mt-4 text-[16px] font-medium text-black/60">
                    Either way you get the same code, and it works at both the
                    smart door and the lock box. Pick whichever you would rather
                    use — you can still use the other one on the night.
                </p>
            </Step>

            <Step number={3} title="Add a note for the villa team">
                <label htmlFor="guestNotes" className={LABEL}>
                    Anything we should know
                    <span className="ml-2 font-medium text-black/40">optional</span>
                </label>
                <textarea
                    id="guestNotes"
                    name="guestNotes"
                    rows={4}
                    disabled={isBlocked || pending}
                    placeholder="Arriving late, travelling with a wheelchair, celebrating something…"
                    className={`${INPUT} resize-y`}
                />
                <p className="mt-2 text-[16px] font-medium text-black/60">
                    Saved with the reservation and read by the team who prepare
                    the villa.
                </p>
            </Step>

            <Step number={4} title="Review and pay">
                <p className="text-[16px] font-medium text-black/60">
                    Your dates are held the moment you press this button, and the
                    payment is attempted straight after. If it fails, the hold is
                    released again immediately.
                </p>

                {/* The only way to reach the decline path on purpose. A demo that can
                    only ever succeed never shows that failure is handled — and this is
                    cheaper and more honest than a card number that must "end in 0002". */}
                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-black/3 p-5">
                    <input
                        type="checkbox"
                        name="declineOnPurpose"
                        disabled={isBlocked || pending}
                        className="mt-0.5 size-4 accent-black"
                    />
                    <span className="text-[16px] font-medium text-black/60">
                        Simulate a declined payment, to see what happens when it
                        fails.
                    </span>
                </label>

                <button
                    type="submit"
                    disabled={isBlocked || pending}
                    className="mt-8 w-full rounded-[40px] bg-[#131A2B] px-4 py-3.5 text-[16px] font-medium text-white transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {pending ? "Contacting the provider…" : "Confirm and pay"}
                </button>

                <p
                    // `status`, not `alert`: this is standing copy, not something that
                    // appears in response to an action.
                    role="status"
                    className="mt-4 text-center text-[16px] font-medium text-black/60"
                >
                    No money moves. This is a simulated payment on a portfolio
                    site.
                </p>
            </Step>
        </form>
    );
}
