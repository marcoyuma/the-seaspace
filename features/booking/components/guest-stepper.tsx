"use client";

// `/dist/ssr` even inside a Client Component, as amenities-panel.tsx and menu-panel.tsx
// do: these are plain SVGs with no icon context, so the lighter entry point is enough.
import { MinusIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { guestsBooked, type GuestCounts } from "@/features/booking/types";

/** One −/+ pair. Disabled at its bound rather than clamping silently on click. */
function StepperRow({
    label,
    hint,
    value,
    onChange,
    canDecrement,
    canIncrement,
}: {
    label: string;
    hint: React.ReactNode;
    value: number;
    onChange: (next: number) => void;
    canDecrement: boolean;
    canIncrement: boolean;
}) {
    const buttonClass =
        "flex size-8 items-center justify-center rounded-full bg-black/6 text-black transition-colors duration-150 motion-reduce:transition-none enabled:cursor-pointer enabled:hover:bg-black/12 disabled:opacity-30";

    return (
        <div className="flex items-center justify-between gap-6">
            <div>
                <p className="text-[16px] font-semibold text-black">{label}</p>
                <p className="text-[16px] font-medium text-black/60">{hint}</p>
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    disabled={!canDecrement}
                    onClick={() => onChange(value - 1)}
                    aria-label={`Remove one ${label.toLowerCase().replace(/s$/, "")}`}
                    className={buttonClass}
                >
                    <MinusIcon size={14} weight="bold" aria-hidden />
                </button>

                {/* aria-live so the new total is announced after a press — the buttons
                    keep focus, so nothing else would read the change out. */}
                <span
                    aria-live="polite"
                    className="w-5 text-center text-[16px] font-semibold text-black tabular-nums"
                >
                    {value}
                </span>

                <button
                    type="button"
                    disabled={!canIncrement}
                    onClick={() => onChange(value + 1)}
                    aria-label={`Add one ${label.toLowerCase().replace(/s$/, "")}`}
                    className={buttonClass}
                >
                    <PlusIcon size={14} weight="bold" aria-hidden />
                </button>
            </div>
        </div>
    );
}

/**
 * Adults / Children / Infants / Pets, as the reference design lays them out.
 *
 * ⚠️ Only `adults + children` is a real number here — that is what `bookings.num_guests`
 * would store. Infants are excluded by the same rule the footnote states, and the Pets
 * row is permanently disabled: the schema has no column for a pet, so an enabled control
 * would promise storage that does not exist. It is rendered rather than dropped because
 * "Pets aren't allowed" is itself the information a guest came for.
 *
 * @param capacity - `stays.capacity`. Caps adults + children.
 */
export default function GuestStepper({
    guests,
    capacity,
    onChange,
}: {
    guests: GuestCounts;
    capacity: number;
    onChange: (next: GuestCounts) => void;
}) {
    const counted = guestsBooked(guests);
    const roomLeft = counted < capacity;

    return (
        <div className="flex flex-col gap-5">
            <StepperRow
                label="Adults"
                hint="Age 13+"
                value={guests.adults}
                onChange={(adults) => onChange({ ...guests, adults })}
                // Floor of one: a booking with nobody old enough to check in is not a
                // booking, and `bookings_guests_pos` would reject it anyway.
                canDecrement={guests.adults > 1}
                canIncrement={roomLeft}
            />

            <StepperRow
                label="Children"
                hint="Ages 2–12"
                value={guests.children}
                onChange={(children) => onChange({ ...guests, children })}
                canDecrement={guests.children > 0}
                canIncrement={roomLeft}
            />

            <StepperRow
                label="Infants"
                hint="Under 2"
                value={guests.infants}
                onChange={(infants) => onChange({ ...guests, infants })}
                canDecrement={guests.infants > 0}
                // Not capped by capacity — the footnote says infants do not count
                // towards it. Capped at five so the control still has a bound.
                canIncrement={guests.infants < 5}
            />

            <StepperRow
                label="Pets"
                hint={
                    <span className="underline underline-offset-2">
                        Bringing a service animal?
                    </span>
                }
                value={guests.pets}
                onChange={(pets) => onChange({ ...guests, pets })}
                canDecrement={false}
                canIncrement={false}
            />

            <p className="text-[16px] leading-normal font-medium text-black/60">
                This place has a maximum of {capacity} guests, not including infants.
                Pets aren&apos;t allowed.
            </p>
        </div>
    );
}
