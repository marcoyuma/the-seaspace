# Guests — what was built, and what is still planned

**Status: `public.guests` is built** (migration `0006_guests.sql`), and `reviews.guest_id`
replaced `reviews.guest_ref` (migration `0007_reviews_guest_id.sql`). **`bookings` is built
too** (`0009_bookings.sql`, seeded by `seed/0004_bookings_seed.sql`) — see §8 — and as of
`0018_reviews_write_path.sql` **`reviews.booking_id` and the composite foreign key exist as
well**, so a review is now structurally tied to a stay that actually happened. The write path
that fills it lives in [features/reviews/README.md](features/reviews/README.md).

This file used to be a plan for a table that did not exist. It is now the record of what was
actually built, why it differs from that plan, and what is still ahead.

## 1. Context

`public.reviews` (migration `0005`) originally recorded each review's author as **text**:

```
reviews.guest_ref  text not null   -- 'amara-lindqvist'
```

A foreign key cannot point at a table that does not exist, so the owner was named as a slug
until `guests` arrived. Migration `0007` turned that slug into a real foreign key and dropped
it.

### What "verified" means, and why there is still no `is_verified` column

A review is meaningful when it comes from someone who actually stayed. That is a **structural**
property, not a flag:

- A hand-set boolean is a second source of truth. A row can claim `is_verified = true` with no
  stay behind it, and nothing prevents that.
- Once `bookings` exists, a review carries `booking_id`, and verified means
  `booking_id is not null` — derived from a foreign key, which cannot disagree with reality.

`reviews` will gain a `booking_id` column, never an `is_verified` one. ✅ **Both halves now
exist**: `bookings` (§8) and `reviews.booking_id` with its composite foreign key, built by
`0018_reviews_write_path.sql`.

**Two clarifications that only became necessary once it was built**, recorded so the rule is
not reopened from either direction:

1. **A generated column is still the column this refused.** `verified boolean generated
   always as (booking_id is not null) stored` looks like it escapes the objection — it is
   derived, so it cannot lie. It does not escape it. The objection is that a second place
   states a fact the relationship already states, and a generated column is a second place.
   §8 counts three refused booleans; this would be a fourth wearing a different hat.
2. **"Verified" is a property of the data, not a badge.** Nothing in the UI says the word,
   and nothing should. Every review written through `upsert_stay_review()` has a booking
   behind it by construction, and `0018`'s backfill gave the seeded rows one too — so a badge
   would appear on every card and distinguish nothing. What `booking_id` is actually for is
   the three items in §3: the one-review-per-stay cap, the drift guard, and the coverage
   metric.

## 2. What was built

```sql
create table public.guests (
    id                 uuid primary key references auth.users(id) on delete cascade,
    display_name       text not null,
    full_name          text,
    phone_country_code text,
    phone              text,
    nationality        text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
```

Plus, in the same migration:

- `handle_new_guest()` — `security definer`, `set search_path = public`, fired by
  `on_auth_guest_confirmed` **after insert or update of `email_confirmed_at` on `auth.users`**,
  guarded by `when (new.email_confirmed_at is not null)` and made re-entrant with
  `on conflict (id) do nothing`.
- `touch_updated_at()` — hand-written `before update` trigger. `default now()` only fires on
  insert; without this the column would lie forever.
- RLS with **no `anon` policy at all**: `select` and `update` for `authenticated` where
  `auth.uid() = id`, the update policy carrying `with check` as well as `using` so a guest
  cannot rewrite `id` to point at somebody else.

### How it differs from the original plan, and why

The first draft of this document proposed `bigint id` + `public_id uuid` + a nullable
`auth_user_id`, an `email` column, a `guest_ref` column, and a `lower(email)` unique index.
**None of that survived.** Five changes:

| Original | Built | Why |
|---|---|---|
| `bigint id` + `public_id uuid` + `auth_user_id` | `id uuid` that **is** `auth.users.id` | Two identity columns can drift apart; one cannot. No matching step, no linking window, no reconciliation. |
| `email text not null` | **no email column** | `auth.users` already holds it, managed by Supabase and unreachable with the anon key. A second copy is one more PII surface plus a sync trigger that fails silently when a guest changes address. |
| `guest_ref text not null unique` | **no guest_ref column** | Seed emails are derived deterministically from it, so `0007` backfills by joining `auth.users.email`. Keeps the trigger at one permanent version instead of an import-time one and a post-import one. |
| Guests can pre-exist their account | **Account first, always** | See below. |
| `reviews.guest_id` NOT NULL | **nullable** | The account-deletion flow lets a guest keep their review anonymised. See `ACCOUNT-DELETION-POLICY.md`. |

Two revisions from the original draft **did** survive and remain the reasoning on record:
`phone` / `phone_country_code` are `text` (as a number, `088888888` loses its leading zero and
international numbers overflow the range), and `full_name` is stored but never rendered — the
public string is `display_name` (`'Amara L.'`).

### This model was challenged, tested against industry practice, and kept

Worth recording so it is not re-litigated. The coupling was questioned because the original
instinct for this table came from a different pattern: an internal admin site that registers
guests and books on their behalf. Under that pattern the coupling is genuinely wrong.

The research agreed, for that pattern:

- A hotel guest profile is built as the guest interacts with the property and
  **"they don't require guest logins or accounts"**; systems must also deduplicate so one person
  booking via OTA, direct, and an agent does not become three records.
  ([Cloudbeds](https://www.cloudbeds.com/articles/guest-profiles/))
- Domain models should not be keyed by the identity provider — reference the identity id from a
  plain column instead, so the auth provider can be swapped without rebuilding the domain.
  ([CleanArchitecture #415](https://github.com/jasontaylordev/CleanArchitecture/discussions/415),
  [Symfony](https://ngandu.hashnode.dev/decoupling-your-applications-user-model-from-symfonys-security-system))
  In e-commerce the same idea appears as authentication living in a separate subschema from the
  customer entity. ([Red Gate](https://www.red-gate.com/blog/er-diagram-for-online-shop/))

**Both are correct, and neither applies here.** The admin panel does not create accounts, does not
create guests, and does not create bookings — an account is entirely the responsibility of the
person who wants to book. There is therefore no route by which a guest can exist before their own
account, which is the single condition that makes the coupling right rather than merely convenient.

**What would overturn this:** the day an admin, an OTA, a travel agent, or a phone booking may
produce a guest, this decision is wrong and `guests` must gain its own primary key with a nullable
`auth_user_id`. That migration is cheap — `guests.id` is already a uuid, so it stops being a
foreign key and its value is copied into the new column — but the RLS policies must move from
`auth.uid() = id` to `auth.uid() = auth_user_id` at the same time. **Watch for a false pass there:**
existing rows would still have `id = auth_user_id`, so the old policy keeps working for them and
hides the bug until the first admin-created guest appears.

### The consequence worth stating plainly: account claiming is not a feature

Because a `guests` row is created **by** an account, a guest can never pre-exist their own
account. Combined with the product rule that **booking requires an account**, there will never
be a review author without an account either.

So "claim your existing profile" is not a feature here, and never becomes one — which also
means it never becomes an attack surface. The 62 seeded identities were the only claim case
that will ever exist, and they were handled once by
`scripts/create-seed-accounts.mjs` plus the backfill in `0007`.

### Why the trigger keys on `email_confirmed_at`

With **"Confirm email" switched off** in the dashboard — the current development setting —
Supabase stamps `email_confirmed_at` at insert time, so a guest row appears immediately and a
dummy address plus a password is enough to sign in.

The shortcut lives in the **project setting**, not in the schema. The day confirmation is
switched on, this trigger is already correct and linking waits for proof of the mailbox, with
no code change. An `after insert` trigger would have baked the shortcut into the database
permanently.

## 3. Relationships

| Relation | Column | Cardinality |
|---|---|---|
| guest → reviews | `reviews.guest_id` (FK, **not** unique, **nullable**) | `1 ─ N` |
| guest → bookings | `bookings.guest_id` (FK, nullable, `on delete set null`) — **built** | `1 ─ N` |
| stay → bookings | `bookings.stay_id` (FK, NOT NULL, `on delete restrict`) — **built** | `1 ─ N` |
| booking → review | `reviews.booking_id` (unique, nullable) — **still planned** | `1 ─ 0..1` |
| stay → reviews | `reviews.stay_id` (nullable) | `1 ─ N` |

One guest has many bookings; each booking yields at most one review; therefore one guest can
have many reviews, across any villas. In the seed: 26 guests wrote two reviews and 6 wrote
three.

### `guest_id` is nullable, and that nullability means exactly one thing

Every review has an owner today. The column is nullable only so a deleted account can leave its
review behind, anonymised. Migration `0007` pins that meaning in the schema:

```sql
constraint reviews_orphan_is_anonymised
    check (guest_id is not null or author_display_name = 'Former guest')
```

An ownerless review **must** already be anonymised. A bug that clears `guest_id` without
overwriting the displayed identity is rejected by the database.

### Not every guest writes a review, and nothing forces them to

The foreign key sits on the **reviews** side. `bookings` will have no column pointing back, so a
booking with no review is simply the absence of a row. `unique (booking_id)` only caps the
maximum at one; Postgres treats NULLs as distinct in a unique index, so it still permits
unlimited rows with `booking_id is null`.

Consequence: `count(reviews) ≠ count(guests) ≠ count(bookings)`. The gap is itself a real
metric — **reviews collected ÷ bookings already checked out** — and a better third stat than the
current `Recommend` figure in `features/reviews/components/reviews-panel.tsx`.

### Keeping derived columns honest — half applied

`reviews.guest_id` and `reviews.stay_id` will both be derivable from the booking. Duplicated
values can drift apart and quietly corrupt every per-guest figure. Enforce it with a composite
foreign key, not a trigger:

```sql
-- ✅ Applied in 0009_bookings.sql. Redundant on its own (`id` is already unique);
--    it exists only to be the target of the foreign key below.
alter table public.bookings add constraint bookings_id_guest_stay_key
    unique (id, guest_id, stay_id);

-- ✅ Applied in 0018_reviews_write_path.sql — but NOT as written below. The
--    referential actions were missing from this spec, and the default is wrong.
alter table public.reviews add constraint reviews_matches_booking_fkey
    foreign key (booking_id, guest_id, stay_id)
    references public.bookings (id, guest_id, stay_id)
    on update cascade      -- ⚠️ see below; NOT the default
    on delete no action;
```

`MATCH SIMPLE` skips the check when any column is NULL, which is exactly right here: it covers
both an unbooked testimonial (`booking_id` null) and an anonymised review (`guest_id` null)
without needing an exemption for either.

### ⚠️ Why `on update cascade`, and why the default would have broken account deletion

This spec named the columns but not the actions, and the omission mattered. The referenced
side of this key is **not** immutable: `bookings.guest_id` carries `on delete set null` from
`0009`, and `ACCOUNT-DELETION-POLICY.md` records that one `DELETE` on `auth.users` cascades to
`public.guests` and fires that action alongside the matching one on `reviews.guest_id`.

So the referenced key changes mid-cascade, from `(57, uuid, 3)` to `(57, null, 3)`. With
`ON UPDATE NO ACTION` — the default — Postgres **rejects** that update while a referencing row
still points at the old key, and the order of two `set null` actions inside one cascade is not
guaranteed. The observable symptom would have been: deleting an account fails with a foreign
key violation, but only for guests who left a review behind.

`on update cascade` lets it through and produces the outcome `0007` already asks for —
`reviews.guest_id` becomes NULL too, `MATCH SIMPLE` then skips the check, and the review
survives anonymised.

**This makes an ordering in the application load-bearing.**
`reviews_orphan_is_anonymised` requires `author_display_name = 'Former guest'` at the moment
`guest_id` empties, so the `anonymize` branch in `features/auth/server-actions.ts` must
overwrite the author columns *before* deleting the account. It already does. Do not reorder it.

`DELETE` stays `NO ACTION` deliberately: a booking is never deleted (§8, and `0009`'s comment
on `on delete restrict`), so the constraint becomes one more piece of evidence for that rule
rather than quietly accommodating its violation.

**Do NOT add `unique (guest_id, stay_id)`.** It looks sensible and it is wrong — a guest who
stays at the same villa twice is entitled to two separate reviews.

## 4. Migration path — done

Recorded because the reasoning still matters, not because anything remains to run.

1. ✅ `0006_guests.sql` — table, triggers, RLS.
2. ✅ `node --env-file=.env.local scripts/create-seed-accounts.mjs` — 62 accounts with
   `email_confirm: true`; the trigger produced 62 `guests` rows.
3. ✅ `0007_reviews_guest_id.sql` — added `guest_id`, backfilled by joining the derived email,
   aborted-on-orphans check, dropped `guest_ref`, added `reviews_orphan_is_anonymised`.

> **The backfill was a one-way bridge, valid exactly once**, and only because `reviews` was
> then the sole place guest identity existed. That is no longer true and never will be again:
> guests are created by signup, and reviews attach to guests that already exist. Do not
> reintroduce `select distinct … from reviews` as a way to enumerate guests.

## 5. The columns that are still empty, and how they get filled

`full_name` for the 62 seeded rows is now filled by
`supabase/seed/0003_guests_full_name.sql` (§5.6). What remains empty is
`phone_country_code` and `phone`, and that is deliberate — see §5.5.

**Why `nationality` is filled and `full_name` is not** is worth understanding, because it
answers the whole question: `scripts/create-seed-accounts.mjs` sent `nationality` through
`user_metadata`, so the trigger copied it. The other two were never sent, because we do not
have that data. The mechanism already works — what is missing is a form to feed it.

### 5.1 When each column naturally gets a value

| Column | Filled when | By whom |
|---|---|---|
| `full_name` | Booking checkout | The guest, typed explicitly |
| `phone_country_code` + `phone` | Booking checkout | The guest, typed explicitly |
| all three | any time afterwards | The guest, via a profile page |
| `nationality` | signup (`user_metadata`) or profile | The guest |
| `avatar_path` | any time, via a profile page | The guest, by uploading — see §6 |

Precedent: the minimum needed to **book** on Airbnb is a full name, an email address, a
confirmed phone number and payment details — none of which is required merely to *register*.
([Airbnb Help](https://www.airbnb.com/help/article/1170/what-are-the-requirements-to-book-on-airbnb))

### 5.2 Rule: never derive `full_name` from an email address

Plenty of people use an address that contains no part of their name — a handle, a nickname, a
shared office mailbox. Deriving a name from an email produces a **wrong** identity, and a legal
name is the very last thing that should be guessed: it is what gets printed on the reservation.

A consequence for how data is written: `full_name` is the **primary** value and `display_name`
follows from it. That direction mirrors reality — the legal name is the source, the short form
is the derivative. The current state, where only `'Amara L.'` has ever existed, is an artefact
of build order, not a design.

### 5.3 Required at booking, not `NOT NULL` on the column

`full_name` and `phone` stay **nullable**. An account that has only ever browsed genuinely has
neither, and that is a legitimate state rather than broken data.

The requirement is enforced at the booking step, where it actually applies. Same principle this
project has now used three times: a fact is derived from a relationship, not asserted by a
marker on a column.

### 5.4 ⚠️ The trigger will NOT fill the 62 existing rows

The easiest thing to get wrong. `handle_new_guest()` uses `on conflict (id) do nothing`, so it
populates a row **once, at creation**, and never again:

- Re-running `scripts/create-seed-accounts.mjs` with new metadata does nothing — the accounts
  already exist, and so do the rows.
- Editing `raw_user_meta_data` in the dashboard does **not** flow through to `public.guests`.

Filling `full_name` for the 62 seeded rows therefore needs an explicit `update public.guests`.
That update now exists as **`supabase/seed/0003_guests_full_name.sql`** (step 9 of the runbook),
and it is a separate file for exactly this reason — not because splitting it was tidier.

The same constraint applies to anything else that ever needs backfilling into existing rows:
the trigger will not do it.

The rule that follows, and it must be stated plainly: **after signup, `public.guests` is the
single source of truth.** `raw_user_meta_data` is only the initial seed. A profile page writes
straight to `public.guests` — the RLS `update` policy for `auth.uid() = id` already exists in
`0006` — and never to metadata. Otherwise two copies drift and nothing arbitrates between them.

### 5.5 `phone` stays NULL, deliberately

- There is no source for it, and **no UI reads it** today.
- ⚠️ **Concrete hazard:** an invented `+62` number can be somebody's real number. Every
  Indonesian mobile range is a live allocation; none is reserved for fiction.
- If it ever genuinely needs values for layout testing, the only safe source is an officially
  reserved range: Ofcom's `07700 900000–900999` (permanently reserved for drama and fiction) or
  NANP `555-0100–555-0199`.
  ([Ofcom](https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbers-for-drama))
- An honestly empty column beats invented data that the next person mistakes for real.

### 5.6 The 62 full names

**Applied.** These are written into the database by
`supabase/seed/0003_guests_full_name.sql`, which pairs each name with an explicit email address
rather than computing anything. That file is the operational source; this table is the record of
what was agreed and why.

> **Never derive these from the email in SQL.** `initcap()` capitalises the first letter of each
> word and lowercases the rest, so `sean.mcallister` becomes `Sean Mcallister` — not
> `McAllister`. The same breakage awaits `van Dijk`, `de Boer`, `O'Brien` and `Al-Farsi` the day
> a real guest signs up. Using the email as a *join key* is fine; deriving a *name* from it is
> the thing §5.2 forbids.

**Three constraints bind these names, not two.** The first two were expected: each must
reproduce the live `display_name` (`'Amara L.'` demands first name *Amara* and a surname
starting with *L*) and must be plausible for the live `nationality`.

The third was discovered while checking: **the emails in `auth.users` were already minted from
these names** (`amara-lindqvist` → `amara.lindqvist@example.com`). Those 62 accounts exist. So
a full name written freely — say `Carlos Vega` for `carlos.viera@example.com` — would put the
account permanently at odds with itself. The names below are therefore *recovered*, not
invented, and each one has been verified to reproduce both its live `display_name` and its live
email address.

That is not a breach of the rule in §5.2. The rule forbids deriving a name from an email for a
**real** person. Here the arrow runs the other way: the name came first and the email was
minted from it. For real guests the name is always typed, never computed.

| Full name | display_name | Nationality |
|---|---|---|
| Adriana Lopes | Adriana L. | Brazilian |
| Amara Lindqvist | Amara L. | Swedish |
| Amelia Hartley | Amelia H. | Australian |
| Andres Quintero | Andres Q. | Colombian |
| Anya Volkova | Anya V. | Russian |
| Arjun Mehta | Arjun M. | Indian |
| Beatriz Alves | Beatriz A. | Brazilian |
| Bruno Schmid | Bruno S. | Swiss |
| Carlos Viera | Carlos V. | Spanish |
| Chloe Beaumont | Chloe B. | French |
| Clara Esposito | Clara E. | Italian |
| Connor Flanagan | Connor F. | Irish |
| Daniel Okonkwo | Daniel O. | Nigerian |
| Dimitri Katsaros | Dimitri K. | Greek |
| Elena Petrova | Elena P. | Bulgarian |
| Emil Rasmussen | Emil R. | Danish |
| Felipe Cardenas | Felipe C. | Chilean |
| Gavin Treharne | Gavin T. | Welsh |
| Genie Junior | Genie J. | Emirati |
| Hana Kowalski | Hana K. | Polish |
| Hendrik Visser | Hendrik V. | Dutch |
| Henrik Nilsson | Henrik N. | Swedish |
| Hollie Marsden | Hollie M. | British |
| Ingrid Solberg | Ingrid S. | Norwegian |
| Isabelle Caron | Isabelle C. | French |
| James Whitfield | James W. | British |
| Jonas Weber | Jonas W. | German |
| Keiko Arata | Keiko A. | Japanese |
| Kristoffer Dahl | Kristoffer D. | Danish |
| Leila Farahani | Leila F. | Iranian |
| Linnea Kallio | Linnea K. | Finnish |
| Lotte Jansen | Lotte J. | Dutch |
| Lucas Fontaine | Lucas F. | Belgian |
| Marcus Oyelaran | Marcus O. | Nigerian |
| Margot Dubois | Margot D. | French |
| Mariko Tanabe | Mariko T. | Japanese |
| Martin Novak | Martin N. | Czech |
| Mei Lin Chow | Mei Lin C. | Singaporean |
| Nadia Benali | Nadia B. | Moroccan |
| Naomi Sato | Naomi S. | Japanese |
| Noor Haddad | Noor H. | Lebanese |
| Oscar Halvorsen | Oscar H. | Norwegian |
| Paulo Ribeiro | Paulo R. | Portuguese |
| Petra Horvath | Petra H. | Hungarian |
| Priya Raghunathan | Priya R. | Indian |
| Rachel Goldstein | Rachel G. | Canadian |
| Rafael Moreno | Rafael M. | Portuguese |
| Ravi Chandrasekar | Ravi C. | Indian |
| Samuel Adeyemi | Samuel A. | Nigerian |
| Sean McAllister | Sean M. | Scottish |
| Siobhan Kelly | Siobhan K. | Irish |
| Sofia Lindberg | Sofia L. | Swedish |
| Stefan Bauer | Stefan B. | Austrian |
| Tanya Pillai | Tanya P. | Malaysian |
| Theo Lambert | Theo L. | French |
| Tomas Brandt | Tomas B. | German |
| Valentina Rossi | Valentina R. | Italian |
| Victor Nguyen | Victor N. | Vietnamese |
| Wei Zhang | Wei Z. | Chinese |
| Yuki Morishima | Yuki M. | Japanese |
| Yusuf Demir | Yusuf D. | Turkish |
| Zara Ibrahim | Zara I. | Malaysian |

**One entry is knowingly odd.** `Genie Junior` does not read as an Emirati name. It is inherited
from the original hardcoded review in the old `features/home/components/reviews.tsx`, and both
the live `display_name` and the live email `genie.junior@example.com` are built from it.
Changing it now would break both. Left as-is on purpose; fix it only if the account is recreated.

### 5.7 Open questions, deliberately unanswered

- **Phone verification.** Airbnb requires a *confirmed* number to book; we have no mechanism at
  all. Supabase Auth supports Phone OTP but needs a paid SMS provider. To be decided when
  booking checkout is designed — until then, a number in `guests` is an unproven string and any
  UI showing it must not imply otherwise.
- **Whether a legal name stays editable** once it has been used on a reservation.
- **Where `nationality` comes from for real signups** — a field on the signup form, or left
  empty until booking.

## 6. Avatar — moved

The avatar contract now lives with the page that will own the feature:
**[features/account/README.md](features/account/README.md)**.

That file carries what used to be here in full — the two-column rationale, the
`<guest_uuid>/<random>.webp` path convention, the EXIF-stripping and re-encoding
requirements, and how the deletion flow has to remove the file itself. The schema half is
still `0008_guest_avatars.sql`, unchanged.

## 7. Still ahead

- ✅ **`bookings`** — built by `0009_bookings.sql`, seeded with 140 rows by
  `seed/0004_bookings_seed.sql`. `guest_id` got its `on delete set null` as required above.
  Details and the decisions behind the columns are in §8.
- ✅ **`reviews.booking_id` + the composite FK — built** by `0018_reviews_write_path.sql`,
  with the backfill matching each seeded review to the booking sharing its guest and villa.
  The backfill pairs by `row_number()` on both sides rather than a plain join: a guest may
  hold two reviews for the same villa, and `unique (booking_id)` would reject the second
  non-deterministically. See §3 for the referential actions, which this document originally
  left unspecified.
- ✅ **Auth in the application** — built. `@supabase/ssr`, `proxy.ts` (Next 16's name for
  `middleware.ts`), `/login` and `/account`. Documented in
  [features/auth/README.md](features/auth/README.md), the single auth
  document.
  The caching hazard noted here previously is gone: `lib/supabase.ts` no longer forces
  `next: { revalidate, tags }` onto every request. Caching moved to `use cache` at the
  function level when the data layer migrated to Cache Components, so the shared client can
  no longer cache an authenticated response.
- ✅ **Review write path — built**, but *not* as an RLS `insert` policy. That plan was wrong
  for the reason `0011` §1 gives about bookings: a policy authorises WHO is writing and cannot
  constrain WHAT they wrote, so `auth.uid() = guest_id` would still permit a five-star review
  attached to a villa the guest never booked. `upsert_stay_review()` is a `security definer`
  function whose parameter list is the allow-list — a booking, a rating, and some words.
  Everything else (villa, guest, displayed identity) is read inside it.
  Documented in [features/reviews/README.md](features/reviews/README.md).
- **Account deletion UI** — specified in `ACCOUNT-DELETION-POLICY.md`, not built.
- **Moderation** — who approves a review, and whether that needs a state column.

## 8. `bookings` — what was built, and the decisions that are not visible in the DDL

Built by `0009_bookings.sql`, seeded by `seed/0004_bookings_seed.sql`. The column list started
from the Wild Oasis course schema and was translated rather than copied; the divergences below
are decisions, and re-litigating them without new information is wasted work.

| Course column | Built as | Why |
|---|---|---|
| `camelCase` | `snake_case` | Every other table here |
| `cabinId` | `stay_id` | `cabins` was dropped in `0003` |
| `startDate` / `endDate` `timestamp` | `date` | Check-in 15:00 / check-out 11:00 is a property-wide policy (`faq-section.tsx`), not a per-row fact. Storing it 140 times stores the same constant while inviting timezone ambiguity |
| `numNights` plain column | generated | A nights count that can disagree with its own dates is the same second-source-of-truth mistake refused in §2 and `0005` |
| `cabinPrice` (a total) | `unit_price_per_night` + `discount_per_night`, `total_price` generated | A total cannot reconstruct the rate that produced it. `stays.price_per_night` may change at any time |
| `hasBreakfast`, `extrasPrice` | **dropped** | The site advertises breakfast as *included* (`more-service-and-amenities.tsx`). A paid add-on column would have the database contradicting its own marketing copy |
| `isPaid boolean` | `paid_at timestamptz` | Records *when*; the boolean is `paid_at is not null`, and the reverse cannot be recovered |
| `observations` (a staff note) | `guest_notes` | `ADMIN-PANEL-CONTEXT.md` rules out an admin touching bookings, so a staff-note column had no possible author |
| no RLS | RLS on the `guests` pattern | The anon key ships to the browser, and these rows carry prices, notes, and every villa's occupancy calendar |

### `status` is a column, and that is not a contradiction

This project has now refused a boolean three times (`is_verified`, `guest_ref`, `is_paid`), so
keeping `status` needs justifying. **Check-in and check-out are real-world events that nothing
else in the database records.** They cannot be derived: a stay whose `end_date` has passed may
have been a no-show, and a cancellation says nothing about the calendar. The values are
`confirmed`, `checked_in`, `checked_out`, `cancelled`; the course's `unconfirmed` is absent
because there it means "booked but not yet checked in", which `confirmed` already covers.

Two things `status` genuinely cannot promise, both asserted by verification block K instead of
by a constraint: it cannot be checked against the calendar (`CHECK` requires IMMUTABLE and
`now()` is not), and **it goes stale on its own** — the seeded `checked_in` rows drift out of
their window within about a week, because nothing advances a status column without a job to do
it. That will be just as true of real bookings.

### ⚠️ Overlapping bookings are NOT prevented by the database

Decided deliberately: two bookings for the same villa on the same dates are prevented at the
**input path**, where the date picker only offers free dates. An `exclude using gist` constraint
over `daterange` was considered and declined.

**The consequence, recorded so nobody is surprised by it:** a read-time check is not a lock, so
two guests submitting the same dates simultaneously are both accepted. If that ever matters, the
fix is `btree_gist` plus an exclusion constraint on `bookings` — **not** more validation in the
form, which cannot close a race by construction. Until then `bookings_stay_dates_idx` exists to
keep the availability lookup off a sequential scan, the seed data is genuinely overlap-free, and
block K in `supabase/README.md` is the only thing that will catch a violation.

### Why the seed derives 100 rows from `reviews`, and why that is not a precedent

Real causality is booking → review. `seed/0004` reconstructs the arrow backwards because reviews
were seeded a phase earlier and already hold the guest, the villa, and the date each review was
written; retyping those 100 triples would be a second copy that can drift.

That is a **one-off reconstruction**, the same species as the backfill in `0007` and valid for
the same reason. It does not soften the rule in §4: `reviews` is not a source of guests, and now
not a source of bookings either. The 40 rows in Part B are an explicit list precisely so the file
cannot be read as "bookings are a function of reviews".

One detail worth knowing before editing that file: **stay lengths are pinned to 2–4 nights by
the review seed.** `0002_reviews_seed.sql` spaces `days_ago` exactly 4 days apart within each
villa, and with check-out one day before the review, any stay longer than 4 nights collides with
the previous one. Widen it and the seed silently double-books villas — with no constraint to
stop it.
