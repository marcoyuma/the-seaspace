# Guests — what was built, and what is still planned

**Status: `public.guests` is built** (migration `0006_guests.sql`), and `reviews.guest_id`
replaced `reviews.guest_ref` (migration `0007_reviews_guest_id.sql`). **`bookings` is now built
too** (`0009_bookings.sql`, seeded by `seed/0004_bookings_seed.sql`) — see §8 — but
`reviews.booking_id` is not, so a verified review still does not exist.

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

`reviews` will gain a `booking_id` column, never an `is_verified` one. **Bookings now exist
(§8), but `reviews.booking_id` does not — so there is still no verification mechanism.** The
table was the harder half; what remains is one nullable column and the composite foreign key
below.

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

-- ❌ Not applied. Needs reviews.booking_id, which does not exist yet.
alter table public.reviews add constraint reviews_matches_booking_fkey
    foreign key (booking_id, guest_id, stay_id)
    references public.bookings (id, guest_id, stay_id);
```

`MATCH SIMPLE` skips the check when any column is NULL, which is exactly right here: it covers
both an unbooked testimonial (`booking_id` null) and an anonymised review (`guest_id` null)
without needing an exemption for either.

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

## 6. Avatar — complete context for whoever builds the upload

**Schema is done** (`0008_guest_avatars.sql`). **The upload feature is not built**, and will be
built in a separate session. This section is written to stand on its own: everything needed is
here, with no need to reconstruct the reasoning from elsewhere.

### What exists after `0008`

| Object | What it holds |
|---|---|
| `guests.avatar_path` | Bucket-relative path, e.g. `a1b2…/f7c9.webp`. **Not a URL.** `NULL` = no photo |
| `reviews.author_avatar_path` | A copy of that path, taken when the review is written |
| bucket `guests` | Public, 512 KB limit, `image/webp\|jpeg\|png\|avif` |
| 4 policies on `storage.objects` | Read: anyone. Insert/update/delete: only into `auth.uid()`'s own folder |

### Why there are two columns and not one

`public.guests` has **no `anon` policy at all** — it holds phone numbers. A visitor who has not
logged in cannot read `avatar_path` from it, and the join returns nothing **without raising an
error**: the avatar would just be blank forever and look like an unfinished feature.

So the path is copied onto the review row, exactly as `author_display_name` and
`author_nationality` already are, for exactly the same reason. **Do not normalise it away.**

Accepted consequence: **changing your photo does not update older review cards.** A review is a
record of a moment, so this is defensible — but it is a choice, and if it ever becomes
unacceptable the fix is to update the guest's review rows at upload time, not to add a join.

### Path convention

```
<guest_uuid>/<random>.webp
```

- The **first folder is the owner**. The storage policies compare it to `auth.uid()`, so this is
  not cosmetic — get it wrong and either nobody can upload or everybody can overwrite everybody.
- The **filename must change on every upload**. A stable name means the CDN keeps serving the old
  photo after a replacement, and the guest concludes the upload failed. Delete the previous object
  after the new path is committed to the column.

### Reading it

`publicStorageUrl("guests", avatar_path)` from [lib/supabase.ts](lib/supabase.ts) — already exists,
nothing to write. Rendered in two places, both of which keep `UserCircleIcon` as the fallback when
the path is `NULL`; the icon is not deleted, it changes role:

- [features/reviews/components/review-card.tsx](features/reviews/components/review-card.tsx) — 54px
- [ui/profile-icon.tsx](ui/profile-icon.tsx) — 38px

### ⚠️ Upload contract — the part that is actually dangerous

A publicly readable avatar URL is **not** a security problem; public buckets are designed for it.
The risk lives entirely in the upload pipeline, and it is not theoretical:

- **Strip EXIF.** Photos carry GPS coordinates. John McAfee was located in 2012 from metadata in a
  photo that had been published.
  ([EDUCAUSE](https://er.educause.edu/articles/2021/6/privacy-implications-of-exif-data))
- **Validate the real MIME type, not the extension**, and **re-encode the image** rather than
  storing the uploaded bytes. A real advisory: a profile-photo feature exposed EXIF metadata, the
  app rendered HTML found inside it, and the result was a working phishing form leading to account
  takeover. ([GHSA-q68h-xwq5-mm7x](https://github.com/HumanSignal/label-studio/security/advisories/GHSA-q68h-xwq5-mm7x))
- Enforce the size limit client-side too; the bucket's 512 KB ceiling is the backstop, not the UX.

### ⚠️ Landmine for that session

[lib/supabase.ts](lib/supabase.ts) forces `next: { revalidate: 3600, tags: ["stays"] }` onto
**every** request passing through it. Uploads and any authenticated query **must not** use that
client — a cached authenticated response gets served to the next visitor. Auth needs its own,
uncached client.

### Prerequisite

Uploading requires an authenticated session. This app has no auth yet: no `@supabase/ssr`, no
`middleware.ts`, no login page. That comes first.

## 7. Still ahead

- ✅ **`bookings`** — built by `0009_bookings.sql`, seeded with 140 rows by
  `seed/0004_bookings_seed.sql`. `guest_id` got its `on delete set null` as required above.
  Details and the decisions behind the columns are in §8.
- **`reviews.booking_id` + the composite FK — still missing, so "verified" still does not
  stand up.** This is now the *only* thing between the schema and a verified review, and
  `0009` already created its target (`bookings_id_guest_stay_key`). What remains is one
  nullable column, the FK from §3, and a backfill matching each seeded review to the booking
  that shares its guest and villa.
- **Auth in the application** — `@supabase/ssr`, `middleware.ts`, login/signup. None of it
  exists; this phase touched no application code.
  ⚠️ `lib/supabase.ts` forces `next: { revalidate: 3600, tags: ["stays"] }` onto **every**
  request. An authenticated query through that client would be cached and served to the next
  visitor. Auth needs its own uncached client.
- **Review write path** — a form plus an RLS `insert` policy on `reviews`, which only becomes
  expressible once auth can prove who is writing.
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
