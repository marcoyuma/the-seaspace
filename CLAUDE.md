@AGENTS.md

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
