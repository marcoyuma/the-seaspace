@AGENTS.md

## Planning & Language

- When presenting a plan, summary, or explanation in chat, use everyday, common Indonesian language
  words. Avoid stiff, overly technical, or academic terms when a simpler word says the same
  thing.
- Don't make something that's already complex sound more complicated — break it into small,
  easy-to-follow steps instead of dense paragraphs.
- Write explanations clearly enough that someone else could follow them, or that I could
  re-read them later without losing context. Don't assume I'll remember the reasoning behind
  a decision.
- This only applies to conversational replies (plans, summaries, explanations in chat).
  Code comments, docs, and markdown files always stay in English — see "Code Comments" below.

## Code Comments

- Comment on _why_, not _what_ — don't restate what the code already makes obvious.
  Avoid: `// increment counter` above `count++`
- Prioritize comments for:
    - Non-trivial or easily misunderstood business logic
    - Reasoning behind a technical choice, especially when there's a trade-off
      (e.g. why a Server Component was used instead of a Client Component)
    - Workarounds for library limitations/bugs — link the related issue if one exists
    - Important assumptions about data shape/format from an API or database
    - Side effects that aren't obvious from the function/variable name
- Don't comment every line — skip anything self-explanatory.
- Use JSDoc for functions, custom hooks, and components exported across files
  (params, return value, and a short usage example if needed).

### Next.js specific

- Explain the reasoning behind `"use client"` when only part of the component needs interactivity.
- Comment on the data-fetching strategy used (`cache: "no-store"`, revalidate, ISR, etc.) and why.
- Comment non-trivial logic in `middleware.ts`, route handlers (`route.ts`), and `layout.tsx`
  (redirects, auth checks, header rewrites, etc.).
- Flag any code that depends on a specific environment variable.

- Keep comments short — ideally 1–2 lines. Avoid paragraph-length comments.
