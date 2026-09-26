"use client";

// Client-side only for the hover preview: the stars light up as the pointer crosses them,
// which is the whole reason this is not five plain radio buttons.
import { useState } from "react";

// `/dist/ssr` even inside a Client Component, as guest-stepper.tsx and amenities-panel.tsx
// do: these are plain SVGs with no icon context, so the lighter entry point is enough.
import { StarIcon } from "@phosphor-icons/react/dist/ssr";

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * The review form's 1–5 star picker: five real radios hidden behind the stars, so arrow keys, Space
 * and FormData work natively. State drives the hover preview ONLY — the checked radio stays the
 * truth, surviving a failed submit. Uncontrolled via `defaultValue`, like every form here.
 *
 * @param defaultValue - The existing rating when editing; `undefined` leaves every star empty.
 * @param name - The FormData key. Defaults to `rating`, which is what the action reads.
 *
 * @example <RatingInput defaultValue={4} />
 */
export default function RatingInput({
    defaultValue,
    name = "rating",
    describedBy,
}: {
    defaultValue?: number;
    name?: string;
    /** Id of the error message, so the whole group points at it rather than one star. */
    describedBy?: string;
}) {
    const [selected, setSelected] = useState(defaultValue ?? 0);
    const [hovered, setHovered] = useState(0);

    // Hover wins while the pointer is over the group; otherwise the real selection shows.
    // Keyboard users never trigger `hovered`, so for them this is always `selected`.
    const shown = hovered || selected;

    return (
        <fieldset
            aria-describedby={describedBy}
            // Resets the preview when the pointer leaves the whole group rather than each
            // star — without this, moving between two stars would flicker back to
            // `selected` in the gap between them.
            onMouseLeave={() => setHovered(0)}
            className="mt-2"
        >
            <legend className="sr-only">Rating, from 1 to 5 stars</legend>

            <div className="flex items-center gap-1">
                {RATINGS.map((value) => {
                    const isFilled = value <= shown;

                    return (
                        <label
                            key={value}
                            onMouseEnter={() => setHovered(value)}
                            className="cursor-pointer p-1"
                        >
                            <input
                                type="radio"
                                name={name}
                                value={value}
                                defaultChecked={value === defaultValue}
                                onChange={() => setSelected(value)}
                                // `sr-only`, not `hidden`/`appearance-none`: it must stay
                                // focusable and arrow-key reachable; the ring below shows focus.
                                className="peer sr-only"
                            />

                            <span className="sr-only">
                                {value} {value === 1 ? "star" : "stars"}
                            </span>

                            <StarIcon
                                size={32}
                                aria-hidden
                                // `fill` for a chosen star, `regular` for the outline of one
                                // not yet reached — so an unrated form reads as five empty
                                // slots rather than as a zero-star review.
                                weight={isFilled ? "fill" : "regular"}
                                fill={isFilled ? "#FFC533" : undefined}
                                className={`rounded-sm transition-colors duration-200 ease-out motion-reduce:transition-none peer-focus-visible:ring-2 peer-focus-visible:ring-black peer-focus-visible:ring-offset-2 ${
                                    isFilled ? "" : "text-black/25"
                                }`}
                            />
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
