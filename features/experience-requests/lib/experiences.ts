import type { ExperienceId } from "@/features/experience-requests/types";

/**
 * The copy that lets one form serve every leisure page: the six fields are shared, only wording and
 * one dropdown differ, so validation, markup and a11y exist once. Shared by the server action and
 * the client form, so it must stay free of anything server-only.
 */
export interface ExperienceRequestConfig {
    /** Label on the pill that opens the modal. */
    ctaLabel: string;
    /** Dialog heading, and its accessible name. */
    title: string;
    /** One line under the heading, in the same voice as the page's hero. */
    subtitle: string;
    /** Wording for the party-size counter: a golf group is not a spa party. */
    partyLabel: string;
    /**
     * Party-size cap, for both `<input max>` and the server check. Golf and spa cap small (bigger
     * groups phone in); a wedding hall doesn't, hence one value per experience.
     */
    maxPartySize: number;
    /** The one field that differs between the two pages. */
    choice: {
        label: string;
        /**
         * The exact strings stored in `experience_requests.preference`. The action rejects
         * anything not in this list, so editing an option only affects requests sent after
         * the edit — rows already stored keep the wording they were sent with.
         */
        options: readonly string[];
    };
    messageLabel: string;
    messagePlaceholder: string;
    /** Shown after a successful submit. Must not promise more than actually happens. */
    confirmation: string;
}

export const EXPERIENCE_REQUESTS: Record<ExperienceId, ExperienceRequestConfig> = {
    "golf-course": {
        ctaLabel: "Book a tee time",
        title: "Book a tee time",
        subtitle:
            "Tell us when you would like to play and how many are in the group. The team confirms the slot by email.",
        partyLabel: "Players",
        maxPartySize: 12,
        choice: {
            label: "Preferred tee time",
            // Windows, not exact times: the course has no slot system behind this, and
            // offering 07:20 would imply one exists.
            options: [
                "Sunrise (06:00 – 09:00)",
                "Late morning (09:00 – 12:00)",
                "Golden hour (15:00 – 18:00)",
                "No preference",
            ],
        },
        messageLabel: "Anything we should know?",
        messagePlaceholder:
            "Handicaps, club hire, a buggy for the back nine — whatever helps us set the round up.",
        confirmation:
            "Request received. The team will confirm your tee time by email within 24 hours.",
    },

    spa: {
        ctaLabel: "Reserve a treatment",
        title: "Reserve a treatment",
        subtitle:
            "Tell us roughly when suits you and what you are after. The team confirms the therapist and the hour by email.",
        partyLabel: "Guests",
        maxPartySize: 12,
        choice: {
            label: "What are you after?",
            // Categories, not named rituals: the spa page describes only the room, so invented
            // names would offer what it never mentions. Real names come with a ritual menu.
            options: [
                "Massage",
                "Facial",
                "Body treatment",
                "Not sure yet — advise me",
            ],
        },
        messageLabel: "Anything we should know?",
        messagePlaceholder:
            "Pressure you prefer, an injury to work around, or an occasion we should know about.",
        confirmation:
            "Request received. The team will confirm your treatment by email within 24 hours.",
    },

    "event-venue": {
        ctaLabel: "Reserve the venue",
        title: "Reserve the venue",
        subtitle:
            "Tell us roughly when and how many. The events team confirms the hall and the layout by email.",
        partyLabel: "Guests",
        // A pavilion, not a treatment room — the two wedding photos on the page itself run
        // well past a hundred guests, so the golf/spa ceiling of 12 would reject the
        // venue's actual use case.
        maxPartySize: 300,
        choice: {
            label: "What are you planning?",
            options: [
                "Wedding",
                "Corporate event or retreat",
                "Private celebration",
                "Not sure yet — advise me",
            ],
        },
        messageLabel: "Anything we should know?",
        messagePlaceholder:
            "Headcount, seating style, AV needs — whatever helps us shape the hall around your day.",
        confirmation:
            "Request received. The events team will confirm availability for the hall by email within 24 hours.",
    },
};

/**
 * Narrows an untrusted string to an `ExperienceId`.
 *
 * The form sends this in a hidden input, so the action must treat it as arbitrary input —
 * `"use server"` exports are public endpoints, form or no form.
 */
export function isExperienceId(value: string): value is ExperienceId {
    // `Object.hasOwn`, not `in`: `in` walks the prototype chain, so `"toString"` would
    // pass and then index to a function.
    return Object.hasOwn(EXPERIENCE_REQUESTS, value);
}
