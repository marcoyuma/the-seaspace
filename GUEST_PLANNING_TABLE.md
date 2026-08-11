# Guests — what was built, and what is still planned

**Status: `public.guests` is built** (migration `0006_guests.sql`), and `reviews.guest_id`
replaced `reviews.guest_ref` (migration `0007_reviews_guest_id.sql`). `bookings` is still a
plan, and so is anything that depends on it.

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

`reviews` will gain a `booking_id` column, never an `is_verified` one. **Bookings still do not
exist, so there is still no verification mechanism.** What changed in this phase is only that
every review now has a real, authenticated owner.

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
| guest → bookings | `bookings.guest_id` — **planned** | `1 ─ N` |
| booking → review | `reviews.booking_id` (unique, nullable) — **planned** | `1 ─ 0..1` |
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

### Keeping derived columns honest, once `bookings` exists

`reviews.guest_id` and `reviews.stay_id` will both be derivable from the booking. Duplicated
values can drift apart and quietly corrupt every per-guest figure. Enforce it with a composite
foreign key, not a trigger:

```sql
alter table public.bookings add constraint bookings_id_guest_stay_key
    unique (id, guest_id, stay_id);

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

All 62 rows currently have `full_name`, `phone_country_code` and `phone` set to `NULL`.

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

Filling `full_name` for the 62 seeded rows therefore needs an explicit `update public.guests`
in a migration. Treat it as its own step; do not assume the trigger covers it.

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

Agreed data, recorded here so the migration that writes them transcribes rather than reinvents.

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

## 6. Still ahead

- **`bookings`** — the table itself, `reviews.booking_id`, the composite FK above, and only
  then does "verified" finally stand up.
  **Decide before creating it:** `bookings.guest_id` needs `on delete set null`, **not**
  `cascade`. Booking and invoice records generally must be retained for tax purposes, and that
  legal obligation outranks an erasure request — a cascade would delete financial records that
  are not allowed to be deleted. See `ACCOUNT-DELETION-POLICY.md` §6.
- **Auth in the application** — `@supabase/ssr`, `middleware.ts`, login/signup. None of it
  exists; this phase touched no application code.
  ⚠️ `lib/supabase.ts` forces `next: { revalidate: 3600, tags: ["stays"] }` onto **every**
  request. An authenticated query through that client would be cached and served to the next
  visitor. Auth needs its own uncached client.
- **Review write path** — a form plus an RLS `insert` policy on `reviews`, which only becomes
  expressible once auth can prove who is writing.
- **Account deletion UI** — specified in `ACCOUNT-DELETION-POLICY.md`, not built.
- **Moderation** — who approves a review, and whether that needs a state column.
