"use client";

// Client-side only for the hover preview: the stars light up as the pointer crosses them,
// which is the whole reason this is not five plain radio buttons.
import { useState } from "react";

// `/dist/ssr` even inside a Client Component, as guest-stepper.tsx and amenities-panel.tsx
// do: these are plain SVGs with no icon context, so the lighter entry point is enough.
import { StarIcon } from "@phosphor-icons/react/dist/ssr";

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * The 1–5 star picker in the review form.
 *
 * Built on five real `<input type="radio">`s, visually hidden behind the stars rather than
 * replaced by them. That is not decoration:
 *
 * - Arrow keys move between options and Space selects, because that is what a radio group
 *   already does. A div-based picker has to reimplement all of it, usually badly.
 * - The value reaches the Server Action through ordinary form submission, so
 *   `saveStayReview` reads `formData.get("rating")` with no client state involved.
 * - React state here drives the hover preview ONLY. The checked radio stays the source of
 *   truth, so a failed submit re-renders with the guest's choice intact.
 *
 * `defaultValue` rather than a controlled `value`, matching every other form in this repo
 * (see features/account/components/profile-form.tsx): the field starts filled when editing
 * an existing review and is uncontrolled thereafter.
 *
 * @param defaultValue - The guest's existing rating when editing, or `undefined` for a new
 *   review. No star is filled until they pick one.
 * @param name - The FormData key. Defaults to `rating`, which is what the action reads.
 *
 * @example
 * <RatingInput defaultValue={4} />
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
                                // `sr-only`, not `hidden` or `appearance-none`: the input has
                                // to stay focusable and reachable by arrow keys. The ring
                                // below is what makes that focus visible, since the input
                                // itself is off-screen.
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
