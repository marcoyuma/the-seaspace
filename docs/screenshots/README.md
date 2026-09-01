# Screenshots

The four images the root `README.md` embeds. GitHub renders a broken-image icon for any file
that is missing, so capture all four in one pass rather than adding them one at a time.

| File | What to capture | Where |
|---|---|---|
| `hero.png` | Landing page, top of the fold — let the intro preloader finish first | `/` |
| `stays.png` | The villa catalogue grid, cards fully loaded | `/stays` |
| `booking-calendar.png` | The availability calendar open, with a date range selected | `/stays/[stayId]` |
| `check-in.png` | The QR code and door code on a confirmed trip | trip page, after booking |

**Capture settings**

- Desktop viewport, ~1440px wide. Take these from the live site
  (<https://the-seaspace-seven.vercel.app>) so what a reader sees matches what they can click.
- PNG. Keep each file under ~500 KB — a README that takes seconds to paint defeats the point.
- No browser chrome, no bookmarks bar, no personal email visible in the header.
- Sign in with the demo account (`co@example.com`) for the two booking shots, so the trip and
  calendar states are real rather than staged.
