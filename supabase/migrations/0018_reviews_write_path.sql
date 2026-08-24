-- 0018_reviews_write_path.sql
-- The link between a review and the stay behind it, and the only way a guest
-- can write one.
--
-- Run EIGHTEENTH, after 0017_stays_revalidate_webhook.sql. Its real
-- prerequisites are only 0005_reviews.sql and 0009_bookings.sql — the numbering
-- reflects order of authorship, not a dependency on 0014-0017.
-- Idempotent: safe to re-run.
--
-- ---------------------------------------------------------------------------
-- What this closes
-- ---------------------------------------------------------------------------
-- Three files have been waiting on this one:
--
--   0005_reviews.sql: "Once public.bookings exists, this table gains
--     `booking_id references public.bookings(id)` and a review is verified
--     exactly when `booking_id is not null` — derived from a foreign key,
--     which cannot lie."
--   0009_bookings.sql: created `bookings_id_guest_stay_key`, a unique
--     constraint that is redundant on its own, purely to be the target of the
--     composite foreign key below.
--   GUEST_PLANNING_TABLE.md §7: "Review write path — a form plus an RLS insert
--     policy on reviews. Now expressible: auth can prove who is writing."
--
-- On that last point this file disagrees with its own spec, and §1 of
-- 0011_booking_writes.sql already explains why: an INSERT policy authorises
-- WHO is writing and cannot constrain WHAT they wrote. A policy scoped to
-- `auth.uid() = guest_id` would still let a crafted request insert a five-star
-- review attached to a villa the guest never booked. So the write path is a
-- SECURITY DEFINER function whose PARAMETER LIST is the allow-list — the same
-- shape as create_booking().
--
-- ---------------------------------------------------------------------------
-- What this deliberately does NOT add
-- ---------------------------------------------------------------------------
-- No `verified` column, in any form — not a boolean, and not a generated one
-- derived from `booking_id is not null`. This schema has refused that column
-- three times (GUEST_PLANNING_TABLE.md §8 counts them: is_verified, guest_ref,
-- is_paid), and a generated column is still the same column: one more place
-- that states a fact the relationship already states.
--
-- There is no "Verified stay" badge in the UI either, and adding one would be
-- pointless rather than merely redundant: every review written through
-- upsert_stay_review() has a booking behind it by construction, and the
-- backfill below gives the seeded rows one too. A badge that appears on every
-- card distinguishes nothing.
--
-- What `booking_id` is actually FOR, per GUEST_PLANNING_TABLE.md §3:
--   1. `unique (booking_id)` caps a stay at one review
--   2. the composite FK stops reviews.guest_id / reviews.stay_id drifting away
--      from the booking they claim to describe
--   3. a future metric — reviews collected ÷ bookings already checked out

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.reviews
    add column if not exists booking_id bigint;

-- Unique, NOT `not null`. Postgres treats NULLs as distinct in a unique index,
-- so this caps the maximum at one review per booking while still permitting
-- unlimited rows with `booking_id is null` — a testimonial that names no
-- reservation. GUEST_PLANNING_TABLE.md §3 asks for exactly this.
create unique index if not exists reviews_booking_id_key
    on public.reviews (booking_id);

-- ⚠️ Do NOT add `unique (guest_id, stay_id)`. It looks sensible and it is
-- wrong: a guest who stays at the same villa twice is entitled to two separate
-- reviews. Recorded in §3 for the same reason.

-- A separate column from created_at, and that separation is load-bearing.
-- 0005 calls created_at "load-bearing, not an audit column": the landing-page
-- carousel reads `order by created_at desc limit 8`, so touching it on an edit
-- would silently reorder the section every time somebody fixed a typo.
alter table public.reviews
    add column if not exists updated_at timestamptz not null default now();

-- public.touch_updated_at() already exists, written by hand in 0006_guests.sql
-- for public.guests. Reused rather than redefined — a second copy of a
-- three-line trigger function is a second thing that can drift.
drop trigger if exists reviews_touch_updated_at on public.reviews;

create trigger reviews_touch_updated_at
    before update on public.reviews
    for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. The composite foreign key
-- ---------------------------------------------------------------------------
-- GUEST_PLANNING_TABLE.md §3 specifies this constraint and its target. What §3
-- does not specify — because it was written before this column existed — is the
-- referential ACTIONS, and the default is wrong here in a way that only shows
-- up in the account-deletion flow.
--
-- ⚠️ Read this before changing either action.
--
-- ACCOUNT-DELETION-POLICY.md §"Urutan operasinya" records that one DELETE on
-- auth.users cascades to public.guests, which then fires `on delete set null`
-- on BOTH reviews.guest_id (0007) and bookings.guest_id (0009).
--
-- This constraint sits across exactly those two columns. When bookings.guest_id
-- goes uuid -> NULL, the referenced key changes, and the ON UPDATE action
-- decides what happens to the rows pointing at the old one. The default
-- (NO ACTION) REJECTS that update while a referencing row still exists — and
-- the order of two `set null` actions inside a single cascade is not
-- guaranteed. The observable failure would be: deleting an account raises a
-- foreign key violation, for guests who left a review behind.
--
-- `on update cascade` lets it through, and the result is the one 0007 already
-- asks for: reviews.guest_id becomes NULL too. MATCH SIMPLE then skips the
-- check entirely once any referencing column is NULL, so an anonymised review
-- stays valid with no exemption needed.
--
-- The `reviews_orphan_is_anonymised` constraint from 0007/0008 still applies at
-- that moment, which makes the ORDER in features/auth/server-actions.ts a hard
-- dependency rather than a nicety: the "anonymize" branch overwrites
-- author_display_name to 'Former guest' BEFORE deleting the account. It
-- already does. Do not reorder it.
alter table public.reviews drop constraint if exists reviews_matches_booking_fkey;

alter table public.reviews add constraint reviews_matches_booking_fkey
    foreign key (booking_id, guest_id, stay_id)
    references public.bookings (id, guest_id, stay_id)
    on update cascade
    -- Deliberately NO ACTION for DELETE, not `set null`. A booking is never
    -- deleted — 0009 spends its longest comment on why a financial record is
    -- retained — so this constraint becomes one more piece of evidence for that
    -- rule instead of quietly accommodating its violation. `set null` would
    -- also be actively dangerous: it would clear guest_id without touching
    -- author_display_name, which reviews_orphan_is_anonymised would then
    -- reject anyway, turning a delete into a confusing constraint error.
    on delete no action;

-- ---------------------------------------------------------------------------
-- 3. Backfill: the 100 seeded reviews
-- ---------------------------------------------------------------------------
-- seed/0004_bookings_seed.sql derived 100 bookings FROM the reviews, so a
-- partner exists for each. It is not a plain join, though, for two reasons:
--
--   1. A guest may hold more than one review for the same villa (26 guests
--      wrote two reviews and 6 wrote three, across any villas). Joining on
--      guest + stay alone can therefore match two reviews to one booking, and
--      reviews_booking_id_key would reject the second — non-deterministically,
--      depending on row order.
--   2. seed/0004 places check-out one day before the review's own timestamp, so
--      "the booking whose end_date is nearest this review's date" is not a
--      heuristic here — it is how the pairing was generated in the first place.
--
-- Hence row_number() on both sides: each review takes its nearest booking, and
-- each booking accepts only its nearest review. A pair has to be the other's
-- first choice to be written, which makes the result independent of scan order.
with paired as (
    select r.id as review_id,
           b.id as booking_id,
           row_number() over (
               partition by r.id
               order by abs(b.end_date - r.created_at::date), b.id
           ) as rn_for_review,
           row_number() over (
               partition by b.id
               order by abs(b.end_date - r.created_at::date), r.id
           ) as rn_for_booking
    from public.reviews r
    join public.bookings b
      on b.guest_id = r.guest_id
     and b.stay_id  = r.stay_id
     -- Only a completed stay may back a review, matching the rule
     -- upsert_stay_review() enforces below. A cancelled booking is not
     -- evidence that anybody stayed.
     and b.status   = 'checked_out'
    where r.booking_id is null
      -- Both are needed for the composite FK to hold. An anonymised review
      -- (guest_id null) can never be paired, which is correct: there is no
      -- longer anybody to attribute the stay to.
      and r.guest_id is not null
      and r.stay_id  is not null
)
update public.reviews r
   set booking_id = p.booking_id
  from paired p
 where r.id = p.review_id
   and p.rn_for_review  = 1
   and p.rn_for_booking = 1;

-- Reported, not raised. 0007's backfill aborted on leftovers because an
-- ownerless review was genuinely broken data; a review with no booking is a
-- legitimate state in this schema (see the `unique` note above), so a partial
-- result here is information rather than a failure.
do $$
declare
    v_total    int;
    v_linked   int;
begin
    select count(*), count(booking_id) into v_total, v_linked
    from public.reviews;

    raise notice 'reviews: % total, % linked to a booking, % unlinked',
        v_total, v_linked, v_total - v_linked;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Closing the read path
-- ---------------------------------------------------------------------------
-- 0005 opened this table with `for select to anon, authenticated using (true)`,
-- which was right while every column on it was public marketing copy.
-- `booking_id` is not: it maps a reservation id to the guest who made it and
-- the villa they stayed at, and the anon key ships to the browser, so one
-- `select booking_id, author_display_name from reviews` publishes that mapping.
--
-- 0014 already settled how this project restricts columns, and it is not RLS:
--
--   "Postgres RLS filters ROWS, not COLUMNS. [...] What genuinely restricts
--    columns is a function that only ever selects the columns it means to
--    return."
--
-- Column-level GRANTs are not the answer either, and this is worth recording
-- because it looks like the obvious one. In Postgres a table-level grant is
-- unaffected by a column-level revoke, and Supabase grants table-level SELECT
-- to `anon` and `authenticated` by default — so `revoke select (booking_id)`
-- would silently do nothing at all. Making it work means revoking the table
-- grant and re-granting every other column by name, which then breaks the day
-- somebody adds a column and forgets.
--
-- So: the grant goes, and the reads move to the four functions in §5, whose
-- RETURN TYPES are the allow-list.
revoke select on public.reviews from anon, authenticated;

-- The policy from 0005 is deliberately LEFT IN PLACE, and it is not dead code.
-- With the grant revoked it can never be reached — a missing privilege is
-- checked before any policy is. It stays as the second layer: if a future
-- migration ever restores SELECT on this table, `using (true)` is still the
-- correct row-level answer for public reviews, and its absence would instead
-- mean nothing was readable at all. The grant is the gate; the policy is the
-- net under it.
--
-- ⚠️ `service_role` is unaffected and must stay that way: the account-deletion
-- flow in features/auth/server-actions.ts reads and rewrites these rows through
-- createAdminClient(), and scripts/create-seed-accounts.mjs reads them too.

-- ---------------------------------------------------------------------------
-- 5. The read functions
-- ---------------------------------------------------------------------------

-- The newest reviews, at most one per author, for the landing-page carousel.
--
-- This replaces a JS loop, and the code it replaces asked for it by name.
-- features/reviews/actions.ts carried an overfetch factor and a dedupe pass
-- with this comment: "Deduping in JS rather than in the database because
-- PostgREST has no `distinct on`. [...] an `.rpc()` would work too now that
-- caching is function-level rather than fetch-level." This is that rpc.
--
-- ⚠️ The dedupe key is NOT plain `guest_id`. `distinct on` treats every NULL as
-- equal, and a NULL guest_id means a deleted account ('Former guest') — those
-- are DIFFERENT people, so collapsing them into one row would drop real
-- reviews. Keyed on the id instead in that case, which is precisely what the
-- JS it replaces did.
create or replace function public.get_latest_reviews(p_limit int default 8)
returns table (
    id                  bigint,
    author_display_name text,
    author_nationality  text,
    author_avatar_path  text,
    rating              smallint,
    quote               text,
    stay_slug           text
)
language sql
stable
security definer
set search_path = ''
as $$
    select d.id, d.author_display_name, d.author_nationality,
           d.author_avatar_path, d.rating, d.quote, d.stay_slug
    from (
        select distinct on (coalesce(r.guest_id::text, 'anon:' || r.id))
               r.id, r.author_display_name, r.author_nationality,
               r.author_avatar_path, r.rating, r.quote,
               s.slug as stay_slug, r.created_at
        from public.reviews r
        left join public.stays s on s.id = r.stay_id
        order by coalesce(r.guest_id::text, 'anon:' || r.id), r.created_at desc
    ) d
    -- The inner query is ordered by the dedupe key, so recency has to be
    -- re-applied out here. Serves the same purpose reviews_recent_idx was
    -- created for in 0005.
    order by d.created_at desc
    limit greatest(p_limit, 0);
$$;

-- Aggregates over EVERY review, which is what the stats row under the carousel
-- describes — the property, not the eight cards on screen.
--
-- Also asked for by the code it replaces: "Aggregated in JS on purpose:
-- PostgREST's own aggregates (`rating.avg()`) depend on a server flag that is
-- not guaranteed to be on." Inside a function there is no such flag.
--
-- `recommend_rate` is the share rated 4 or better, 0-1. The zero-row guard is
-- in the coalesce: avg() over nothing is NULL, and NULL would render as "NaN"
-- once it reached toFixed().
create or replace function public.get_review_stats()
returns table (
    total          bigint,
    average_rating numeric,
    recommend_rate numeric
)
language sql
stable
security definer
set search_path = ''
as $$
    select count(*)                                                   as total,
           coalesce(avg(r.rating), 0)                                 as average_rating,
           coalesce(
               count(*) filter (where r.rating >= 4)::numeric
                   / nullif(count(*), 0),
               0
           )                                                          as recommend_rate
    from public.reviews r;
$$;

-- One villa's reviews, newest first.
--
-- Hits reviews_stay_id_idx, which 0005 created "for per-villa reads on the stay
-- detail page, which do not exist yet". They exist now.
create or replace function public.get_stay_reviews(
    p_slug   text,
    p_limit  int default 6,
    p_offset int default 0
)
returns table (
    id                  bigint,
    author_display_name text,
    author_nationality  text,
    author_avatar_path  text,
    rating              smallint,
    quote               text,
    stay_slug           text
)
language sql
stable
security definer
set search_path = ''
as $$
    select r.id, r.author_display_name, r.author_nationality,
           r.author_avatar_path, r.rating, r.quote, s.slug
    from public.reviews r
    join public.stays s on s.id = r.stay_id
    where s.slug = p_slug
    order by r.created_at desc
    limit greatest(p_limit, 0)
    offset greatest(p_offset, 0);
$$;

-- Every villa's rating in one call, rather than one call per villa.
--
-- One cache entry serves both readers — the detail page (one villa) and the
-- landing-page preview grid (two villas) — and the whole table is four rows, so
-- there is nothing to save by narrowing it. Villas with no reviews are absent
-- rather than returned as zero: "no rating yet" is the caller's cue to render
-- nothing, and a 0.00 average would be a number that reads as a bad review.
create or replace function public.get_stay_rating_summaries()
returns table (
    stay_slug      text,
    total          bigint,
    average_rating numeric
)
language sql
stable
security definer
set search_path = ''
as $$
    select s.slug, count(r.id), avg(r.rating)
    from public.stays s
    join public.reviews r on r.stay_id = s.id
    group by s.slug;
$$;

-- The caller's own review of one booking, for filling in the edit form.
--
-- `authenticated` only, and scoped by auth.uid() inside — unlike the four
-- above, this one answers a question about a specific reservation, so it must
-- not be answerable by anyone holding a booking id.
create or replace function public.get_booking_review(p_booking_id bigint)
returns table (rating smallint, quote text)
language sql
stable
security definer
set search_path = ''
as $$
    select r.rating, r.quote
    from public.reviews r
    where r.booking_id = p_booking_id
      -- Ownership IS the where clause, the same construction
      -- settle_booking_payment() uses: somebody else's review is
      -- indistinguishable from one that does not exist.
      and r.guest_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 6. The write functions
-- ---------------------------------------------------------------------------
-- Custom SQLSTATEs, continuing the series 0011 opened and 0012 extended
-- (SB001-SB014). The application matches on `error.code`, never on message
-- text — PostgREST forwards the code verbatim, and messages are Postgres'
-- to change:
--
--   SB015  no session — auth.uid() is null
--   SB016  the booking is not the caller's, or does not exist
--   SB017  the stay is not finished, so there is nothing to review yet
--   SB018  signed in, but no public.guests row
--
-- 23514 (check_violation, from reviews_rating_range or reviews_quote_len) is
-- left to bubble up as itself, exactly as 0011 leaves 23P01 alone.

-- Writes a review, or rewrites the caller's existing one for the same booking.
--
-- Note what is NOT a parameter: no stay, no guest, no author name, no
-- nationality, no avatar, no timestamp. A caller chooses a booking, a rating
-- and some words. Everything else is read here — which is what makes the
-- denormalised author columns a genuine snapshot rather than three strings the
-- browser supplied.
--
-- One review per booking is the table's rule (reviews_booking_id_key), so the
-- second submission for the same stay is an edit rather than an error. There is
-- no review window: that was decided deliberately, and it is why editing has to
-- exist — a typo with no expiry would otherwise be permanent.
create or replace function public.upsert_stay_review(
    p_booking_id bigint,
    p_rating     smallint,
    p_quote      text
)
returns bigint
language plpgsql
-- VOLATILE (the default) — it writes.
-- SECURITY DEFINER because the table has no INSERT policy for anyone, so the
-- caller's own rights are never enough. Empty search_path is mandatory on a
-- definer function, for the reason 0010 spells out.
security definer
set search_path = ''
as $$
declare
    v_guest_id uuid := auth.uid();
    v_booking  record;
    v_guest    record;
    v_review_id bigint;
begin
    if v_guest_id is null then
        raise exception 'A review must be written by a signed-in guest'
            using errcode = 'SB015';
    end if;

    select b.id, b.stay_id, b.status
    into v_booking
    from public.bookings b
    where b.id = p_booking_id
      -- Ownership as the where clause again. A stranger's booking id and a
      -- nonexistent one produce the same error, which is what stops this
      -- becoming a way to probe for reservations.
      and b.guest_id = v_guest_id;

    if not found then
        raise exception 'No booking % for this guest', p_booking_id
            using errcode = 'SB016';
    end if;

    -- 'checked_out' and nothing else. It is the one status that means somebody
    -- actually arrived AND the stay is over: 0013's hourly job writes it, and
    -- 0013 is explicitly forbidden from writing 'checked_in' because a calendar
    -- cannot know whether anyone walked through the door. So this is the only
    -- value in the vocabulary that a real stay produced.
    --
    -- 'no_show' is excluded on purpose: it is paid for, but nobody was ever
    -- there, and there is no experience to rate.
    if v_booking.status <> 'checked_out' then
        raise exception 'Booking % is %, not a completed stay',
            p_booking_id, v_booking.status
            using errcode = 'SB017';
    end if;

    -- The source of the denormalised author columns. 0005 and 0008 both explain
    -- why they live on the review row rather than being joined at read time:
    -- public.guests has no `anon` policy because it holds phone numbers, so a
    -- join would return nothing for a signed-out visitor WITHOUT erroring — a
    -- permanently blank name that looks like an unfinished feature.
    select g.display_name, g.nationality, g.avatar_path
    into v_guest
    from public.guests g
    where g.id = v_guest_id;

    if not found then
        -- Same case app/(auth)/account/page.tsx and create_booking() both have
        -- copy for: the signup trigger never fired.
        raise exception 'No guest profile exists for this account'
            using errcode = 'SB018';
    end if;

    insert into public.reviews (
        booking_id, stay_id, guest_id,
        author_display_name, author_nationality, author_avatar_path,
        rating, quote
    )
    values (
        p_booking_id, v_booking.stay_id, v_guest_id,
        v_guest.display_name,
        -- author_nationality is NOT NULL while guests.nationality is nullable —
        -- the signup form makes it optional. The empty string is already this
        -- project's value for "no nationality": the anonymise branch in
        -- features/auth/server-actions.ts writes exactly that, per
        -- ACCOUNT-DELETION-POLICY.md. Reused rather than making the column
        -- nullable, so there is one representation instead of two.
        coalesce(v_guest.nationality, ''),
        v_guest.avatar_path,
        p_rating,
        -- Trimmed here so the length check measures what will actually be
        -- stored. The bounds themselves (20-500) stay in
        -- reviews_quote_len — re-checking them here would be a second copy of a
        -- rule the table already enforces, which is how two copies disagree.
        btrim(coalesce(p_quote, ''))
    )
    -- No WHERE on the DO UPDATE, and it does not need one — but the reason is a
    -- chain rather than an obvious fact, so: the conflicting row is the one with
    -- this booking_id, and reviews_matches_booking_fkey forces its guest_id to
    -- equal the booking's guest_id, which the SELECT above already proved is the
    -- caller. So the only row this can ever overwrite is the caller's own.
    --
    -- ⚠️ That guarantee comes from the composite foreign key, not from this
    -- statement. Weaken the FK to `booking_id -> bookings(id)` alone and this
    -- becomes a way to rewrite somebody else's review; add `and reviews.guest_id
    -- = v_guest_id` here at the same time.
    on conflict (booking_id) do update
    set rating     = excluded.rating,
        quote      = excluded.quote
        -- created_at is NOT touched: it decides carousel order (0005), so an
        -- edit must not reshuffle the landing page. updated_at is handled by
        -- reviews_touch_updated_at, not set here.
        --
        -- The author columns are NOT refreshed either. 0008 states the rule for
        -- exactly this case: "changing your photo does not update older review
        -- cards. A review is a record of a moment." An edit rewrites the words,
        -- not who the guest was when they wrote them.
    returning id into v_review_id;

    return v_review_id;
end;
$$;

-- Removes the caller's review of one booking.
--
-- A DELETE, not an anonymisation, and the difference from bookings is the
-- point: 0009 refuses to delete a booking because it is a financial record with
-- a retention obligation. A review is an opinion. Nothing depends on it, no
-- law requires it, and withdrawing one is a normal thing to want.
--
-- Deleting the row also releases the booking to be reviewed again, since
-- reviews_booking_id_key no longer holds it. That is intended: withdrawing a
-- review should not lock the guest out of writing a better one.
create or replace function public.delete_stay_review(p_booking_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_guest_id uuid := auth.uid();
    v_deleted  int;
begin
    if v_guest_id is null then
        raise exception 'A review must be removed by a signed-in guest'
            using errcode = 'SB015';
    end if;

    delete from public.reviews r
     where r.booking_id = p_booking_id
       and r.guest_id   = v_guest_id;

    get diagnostics v_deleted = row_count;

    if v_deleted = 0 then
        -- Same code as an unowned booking, and deliberately so: "you have no
        -- review for that booking" and "that booking is not yours" are the same
        -- sentence from the caller's side, and telling them apart would leak
        -- which one it was.
        raise exception 'No review of booking % for this guest', p_booking_id
            using errcode = 'SB016';
    end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
-- EXECUTE is granted to PUBLIC by default, which on a SECURITY DEFINER function
-- is the whole hazard. Revoke first, then hand each one back to the narrowest
-- role that needs it. `service_role` needs no grant — it bypasses this anyway.
--
-- The four public read functions go to `anon` as well as `authenticated`, and
-- they must: the landing page calls get_latest_reviews() and get_review_stats()
-- at BUILD time with the anon key (supabase/README.md records that `npm run
-- build` fails outright when this table is unreachable). The three
-- guest-specific functions go to `authenticated` only.
revoke all on function public.get_latest_reviews(int)                       from public;
revoke all on function public.get_review_stats()                            from public;
revoke all on function public.get_stay_reviews(text, int, int)              from public;
revoke all on function public.get_stay_rating_summaries()                   from public;
revoke all on function public.get_booking_review(bigint)                    from public;
revoke all on function public.upsert_stay_review(bigint, smallint, text)    from public;
revoke all on function public.delete_stay_review(bigint)                    from public;

grant execute on function public.get_latest_reviews(int)          to anon, authenticated;
grant execute on function public.get_review_stats()               to anon, authenticated;
grant execute on function public.get_stay_reviews(text, int, int) to anon, authenticated;
grant execute on function public.get_stay_rating_summaries()      to anon, authenticated;

grant execute on function public.get_booking_review(bigint)                 to authenticated;
grant execute on function public.upsert_stay_review(bigint, smallint, text) to authenticated;
grant execute on function public.delete_stay_review(bigint)                 to authenticated;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- 1. How much of the backfill landed. Expect 100 total. `linked` is whatever
--    the pairing found — every review whose guest has a matching checked_out
--    booking at that villa. `unlinked` is not a failure (see §3).
select count(*)                                     as reviews,
       count(booking_id)                            as linked,
       count(*) - count(booking_id)                 as unlinked
from public.reviews;

-- 2. No booking carries two reviews. reviews_booking_id_key guarantees it, but
--    prove it rather than trusting the index name. Expect 0 rows.
select booking_id, count(*)
from public.reviews
where booking_id is not null
group by booking_id
having count(*) > 1;

-- 3. Every linked review agrees with its booking about who stayed where. This
--    is what the composite FK enforces, so it is also a check that the FK is
--    actually present and not silently skipped. Expect 0 rows.
select r.id, r.booking_id, r.guest_id, b.guest_id, r.stay_id, b.stay_id
from public.reviews r
join public.bookings b on b.id = r.booking_id
where r.guest_id is distinct from b.guest_id
   or r.stay_id  is distinct from b.stay_id;

-- 4. The constraint exists and is the right shape. Expect one row, contype 'f',
--    definition ending in `ON UPDATE CASCADE`.
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.reviews'::regclass
  and conname = 'reviews_matches_booking_fkey';

-- 5. All seven functions must be SECURITY DEFINER with an empty search_path.
--    Expect prosecdef = true and proconfig = {search_path=} for every row.
select proname, prosecdef, proconfig
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('get_latest_reviews', 'get_review_stats', 'get_stay_reviews',
                  'get_stay_rating_summaries', 'get_booking_review',
                  'upsert_stay_review', 'delete_stay_review');

-- 6. The table is shut and the functions are open. Run from the SQL Editor with
--    the role switched, or from the app with the anon key:
--
--        set local role anon;
--        select count(*) from public.reviews;              -- expect 42501
--        select * from public.get_latest_reviews(8);       -- expect 8 rows
--        select * from public.get_review_stats();          -- expect 100 | 4.66 | ~0.9
--        select * from public.get_stay_rating_summaries(); -- expect 4 rows
--        reset role;
--
--    The first returning rows instead of a permission error means the grant in
--    §4 was re-added somewhere.

-- 7. The write path, end to end. Needs a real session, so run it from the app —
--    but the eligibility query is useful here:
--
--        select b.id, s.slug, u.email
--        from public.bookings b
--        join public.stays s on s.id = b.stay_id
--        join auth.users u   on u.id = b.guest_id
--        where b.status = 'checked_out'
--        order by b.end_date desc
--        limit 5;
--
--    Then sign in as that guest, open /account/trips/{id}, and post a review.
--    Confirm here:
--
--        select rating, quote, booking_id, created_at, updated_at
--        from public.reviews where booking_id = {id};
--
--    Edit it in the UI and re-run: `quote` changes, `updated_at` moves,
--    `created_at` does NOT.

-- 8. ⚠️ The one that gates this migration: account deletion must still work.
--    See §2. With the service role:
--
--        -- pick a guest who has a linked review
--        select r.guest_id, r.booking_id from public.reviews r
--        where r.booking_id is not null limit 1;
--
--    Then run the "anonymize" branch of the deletion flow from the UI for that
--    account (or reproduce it: update the review's author columns to
--    'Former guest' / '' / null, then delete the auth.users row). It must
--    succeed, leaving the review in place with guest_id NULL.
--
--    If it fails with a foreign key violation, `on update cascade` in §2 is
--    wrong and nothing further should be built on this migration.
