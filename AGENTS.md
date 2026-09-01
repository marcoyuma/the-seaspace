<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tailwind: never use the `!` important modifier

Neither spelling — not `!text-[36px]`, not `text-[36px]!`. There are currently zero in this
codebase and it should stay that way.

Reaching for `!` almost always means a shared primitive baked a value into its base class
list that a caller needs to change. Nothing here uses `tailwind-merge`, so `className` is
plain string concatenation: a caller's utility and a base one sit at equal specificity, and
the winner is decided by **Tailwind's CSS generation order**, not by which appears later in
the attribute. `!` is a way to win that fight without addressing it.

**Fix the primitive instead.** Move the contested value out of the base list into a variant
map keyed by a prop, so nothing ever collides:

```tsx
const SIZE = {
    section: "text-[36px] leading-none",
    footer: "text-[28px] sm:text-[34px] md:text-[40px] lg:text-[48px] leading-tight sm:leading-none",
} as const;

className={`w-full font-semibold ${SIZE[size]} ${className}`}
```

`ui/heading.tsx` (`size`) and `ui/text.tsx` (`width`, `weight`) are the reference
implementations. Keep the `className` prop for layout only — margins, `text-center`,
`shrink-0` — and never for values the primitive already sets.

Two consequences worth remembering:

- Tailwind v4 scans **every** non-ignored file, including `.md`. A `!`-prefixed class quoted
  in a doc still emits a real `!important` rule into the bundle.
- Only add a variant a call site actually uses. `Heading` deliberately has no 48px `display`
  entry because nothing needs one.
