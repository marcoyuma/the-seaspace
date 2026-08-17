# Experience requests — asking for a tee time or a treatment

**Status: live on all three leisure pages.** The primary CTA on `/golf-course`, `/spa` and
`/event-venue` opens a modal. Submitting it "sends" the enquiry to the relevant desk — golf,
spa or events — and nothing is written to a database.

---

## 1. This is not a booking, and the whole feature depends on that

A submission says *"someone would like this, roughly then"*. It reserves nothing, blocks no
calendar, quotes no price and takes no money. `preferredDate` is optional, there is no end
date, no capacity check and no total.

[`features/booking`](../booking/README.md) is the opposite: a financial record with a price
snapshot, a database-level overlap constraint and an hourly lifecycle job. The two must not
converge. If tee times ever become genuinely reservable, that is a new feature with real
slots — not this form growing extra fields.

Every piece of copy in `lib/experiences.ts` obeys the same rule: *request*, and *the team
will confirm by email*. Never "booked", never "reserved".

## 2. What actually happens to a submission — a simulated send, on purpose

There is no Seaspace golf desk or spa desk, and there is no database table either. Three
options were weighed:

| Approach | What it proves | Cost |
|---|---|---|
| Fake submit that resolves after a timeout, doing nothing at all | Nothing. Open the network tab and the form goes nowhere. | Zero |
| A real email vendor (Resend, Postmark) | Real delivery, but the artefact is an email nobody can see in a demo. | Domain + API key + account |
| **A simulated send, shaped like a real one** ← chosen | The form behaves exactly like it would with Resend behind it: a network-shaped delay, a success/failure outcome, a message id. Swapping in a real provider later changes one file. | Zero |
| A row in Supabase | Also honest, but this is an enquiry, not a record — there is nothing here worth retaining, and no admin surface reads it. | One migration, for no reader |

**Chosen: `features/experience-requests/lib/email-gateway.ts`.** It mirrors
[`features/booking/lib/payment-gateway.ts`](../booking/lib/payment-gateway.ts) — the same
project already answered this exact question on the payment side, so the same shape
answers it here: an artificial delay (`SEND_DELAY_MS`), a `DEMO-…` message id in place of a
real one, and a `console.log` standing in for the one place the "email" can be inspected at
all.

⚠️ Nothing is persisted. A submitted request leaves no trace once the response is sent —
not in a table, not in a log store, only the one `console.log` line for whoever is watching
the server output at that moment. That is the accepted trade-off for a feature with no
audience to read it back.

## 3. One form, three pages

`lib/experiences.ts` holds a config per experience: the CTA label, the headings, the
party-size wording and ceiling, one dropdown, and the confirmation sentence. Everything
else — the six fields, the validation, the error markup, the focus handling — exists once.

The dropdown (and, for `/event-venue`, the party-size ceiling) is the real difference:

| Page | `preference` offers |
|---|---|
| `/golf-course` | Tee-time **windows**, not exact times. There is no slot system behind this, and offering 07:20 would imply one. |
| `/spa` | **Categories** (massage, facial, body treatment), not named rituals. `spa-relaxation-section.tsx` describes the room and nothing else, so named treatments would have the modal offering something the page never mentions. When that section grows a real ritual menu, these become its names — and only then. |
| `/event-venue` | **Occasion type** (wedding, corporate event or retreat, private celebration), plus a party-size ceiling of 300 instead of golf/spa's 12 — a wedding hall has no business rejecting the guest counts its own hero photos show. |

`/event-venue` followed exactly that recipe: one entry in `EXPERIENCE_REQUESTS`, one entry
in `STAFF_INBOXES`, one `<ExperienceRequestCta>` in its hero. The only addition the recipe
didn't anticipate was `maxPartySize` — see §5.

## 4. Where the client boundary is, and why it is there

The heroes on all three leisure pages are Server Components with a preloaded LCP image.
They stay that way: `ExperienceRequestCta` draws the `"use client"` boundary around the
button alone.

That file also owns a `<Suspense>` boundary, for the same reason `ProfileIcon` has one in
`app/layout.tsx` — the prefill reads cookies, which is request-time data, and an unguarded
read there would drag the whole marketing page out of the static shell. The prefill (name,
email) is cosmetic only: nothing downstream uses the signed-in identity for authorisation,
since there is nothing to authorise a write against.

The fallback is the identical button without the prefill, so the CTA is clickable
immediately. ⚠️ If someone opens the modal inside that window, the swap remounts it and
closes it again. Milliseconds on a streamed response, and the alternative — a dead-looking
placeholder where the page's main CTA belongs — is worse.

## 5. Validation still lives entirely in the Server Action

`server-actions.ts` checks the experience, the name, the email shape, the party size, the
date and the `preference` vocabulary, and caps the message length. There is no database
CHECK constraint behind any of it this time — no table exists — so this file **is** the
whole line of defence, not a courtesy layer in front of one.

That matters because a `"use server"` export is a public endpoint reachable with arbitrary
arguments regardless of what the form sends. Two details worth keeping:

- Past dates are compared against `propertyTodayISO()` (WITA), not the server's UTC clock.
  A guest in Bali asking for this afternoon would otherwise be told their date had passed.
- The date input carries **no** `min` attribute: the modal is kept mounted and renders
  during the prerender of a static page, so a date computed there would be frozen at build
  time.
- The party-size ceiling (`config.maxPartySize`) lives per experience, not as one shared
  constant: golf and spa cap at 12 (a group that size is already a call, not a form), but
  `/event-venue` needs 300 — a wedding is not a spa party. The `<input max>` in
  `experience-request-form.tsx` and the server check in `server-actions.ts` both read the
  same config value, so the two cannot drift apart.

## 6. File map

| File | |
|---|---|
| `lib/experiences.ts` | The per-page copy, the `preference` vocabulary, and `isExperienceId()` |
| `lib/email-gateway.ts` | The simulated send — see §2 |
| `types.ts` | `ExperienceId`, and the `useActionState` shape |
| `server-actions.ts` | `submitExperienceRequest` — the only entry point |
| `components/experience-request-cta.tsx` | Server: the Suspense boundary and the prefill |
| `components/experience-request-button.tsx` | Client: the pill and the modal |
| `components/experience-request-form.tsx` | Client: the fields, the pending state, the confirmation |
| [`ui/modal.tsx`](../../ui/modal.tsx) | The shared dialog shell |

## 7. Still ahead

- **Migrating `booking-modal.tsx` onto `ui/modal.tsx`.** The shell was extracted from it,
  but the booking modal still carries its own copy. Deliberately left alone: it is on the
  critical path of the paid flow and deserves its own commit and its own manual check.
  Until then the two must be kept in step by hand.
- **`See the ritual menu`** on the spa hero still points at an image band with no menu in
  it. When that section gains real treatments, §3 says what changes here.
- **A real provider**, if this feature ever needs to actually reach anyone: replace the
  body of `sendExperienceRequest()` in `email-gateway.ts` with a Resend/Postmark call. The
  return shape (`EmailOutcome`) is designed to stay the same, so nothing in
  `server-actions.ts` would need to change.
