import type { ExperienceId } from "@/features/experience-requests/types";

/**
 * The copy that makes one form serve two pages.
 *
 * Golf and spa ask for the same six things; only the wording and one dropdown differ. A
 * config map rather than two components means the validation, the markup and the
 * accessibility work exist once — and a third page (`/event-venue`) becomes an entry here
 * rather than a third copy of the form.
 *
 * Shared between the server action and the client form, so it must stay free of anything
 * server-only.
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
     * Upper bound on the party-size field, both the `<input max>` and the server check.
     * Golf and spa cap small on purpose — a group that size is already a phone call, not a
     * form. A wedding hall has no such ceiling, hence a distinct value per experience
     * rather than one constant shared across all three.
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
            // Categories, not named rituals. spa-relaxation-section.tsx describes the room
            // and nothing else, so a list of invented treatment names would have the modal
            // offering something the page never mentions. When that section grows a real
            // ritual menu, these become its names — and only then.
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
