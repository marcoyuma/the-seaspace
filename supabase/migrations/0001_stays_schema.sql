-- 0001_stays_schema.sql
-- Catalogue schema for the stays feature: villas, their photos, and amenities.
-- Mirrors the `Stay` / `StayImage` / `Amenity` types in features/stays/data.ts,
-- minus `ferryUrl` (dropped) and with the nested objects flattened into columns.
--
-- Run FIRST. Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- stays
-- ---------------------------------------------------------------------------
-- `slug` (not `id`) is the /stays/[stayId] URL segment. Keeping a numeric PK
-- means a slug can be renamed without cascading through every child row.
create table if not exists public.stays (
    id              bigint generated always as identity primary key,
    created_at      timestamptz  not null default now(),
    slug            text         not null unique,
    name            text         not null,
    location        text         not null,
    price_per_night integer      not null,           -- whole IDR, not cents
    discount        integer      not null default 0, -- whole IDR off; no UI renders this yet
    capacity        smallint     not null,           -- guests
    beds            smallint     not null,
    area            smallint     not null,           -- m²
    is_new          boolean      not null default false,
    description     text         not null,
    bed_type_label  text         not null,
    bed_type_note   text,                            -- nullable: `bedType.note?` in TS
    capacity_label  text         not null,           -- free text, e.g. "4 adults and 2 children"
    lat             numeric(9,6) not null,
    lng             numeric(9,6) not null,
    airport_code    text         not null,
    airport_city    text         not null,

    -- The slug lands straight in a URL path, so the DB refuses anything that
    -- would need escaping rather than trusting every future insert path.
    constraint stays_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint stays_price_pos   check (price_per_night > 0),
    constraint stays_discount_ok check (discount >= 0 and discount < price_per_night),
    constraint stays_capacity_pos check (capacity > 0 and beds > 0 and area > 0),
    constraint stays_lat_range   check (lat between  -90 and  90),
    constraint stays_lng_range   check (lng between -180 and 180)
);

-- ---------------------------------------------------------------------------
-- stay_images
-- ---------------------------------------------------------------------------
-- Static imports hand Next three things for free: dimensions, a blur
-- placeholder, and a hashed URL. A remote URL has none of them, so width,
-- height and blur_data_url are stored here instead — generated once at upload
-- (scripts/upload-stays-images.ts) rather than recomputed on every render.
--
-- storage_path is relative to the bucket; the public URL is assembled from
-- NEXT_PUBLIC_SUPABASE_URL at read time, so moving projects or regions never
-- becomes a data migration.
create table if not exists public.stay_images (
    id            bigint generated always as identity primary key,
    stay_id       bigint   not null references public.stays(id) on delete cascade,
    storage_path  text     not null unique,
    alt           text     not null,
    blur_data_url text,
    width         integer  not null,
    height        integer  not null,
    sort_order    smallint not null,

    -- sort_order 0 doubles as the card/cover image, so it must be unambiguous.
    unique (stay_id, sort_order),
    constraint stay_images_sort_nonneg check (sort_order >= 0),
    constraint stay_images_dims_pos    check (width > 0 and height > 0)
);

create index if not exists stay_images_stay_id_idx
    on public.stay_images (stay_id, sort_order);

-- ---------------------------------------------------------------------------
-- amenities + stay_amenities
-- ---------------------------------------------------------------------------
-- `is_shared` marks the six amenities every villa currently ships with (the
-- SHARED_AMENITIES spread in data.ts). It keeps their *text* single-source —
-- editing the Wi-Fi detail once updates every villa — while membership stays
-- explicit in the join table so a future villa can opt out.
create table if not exists public.amenities (
    id        bigint generated always as identity primary key,
    slug      text    not null unique,  -- the `Amenity.id` string in TS, e.g. 'wifi'
    label     text    not null,
    detail    text    not null,
    is_shared boolean not null default false,

    constraint amenities_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table if not exists public.stay_amenities (
    stay_id    bigint   not null references public.stays(id)     on delete cascade,
    amenity_id bigint   not null references public.amenities(id) on delete cascade,
    -- Per-stay amenities use 0..9, shared ones 10+, reproducing the current
    -- render order (villa-specific first, then the shared block).
    sort_order smallint not null,

    primary key (stay_id, amenity_id)
);

create index if not exists stay_amenities_stay_id_idx
    on public.stay_amenities (stay_id, sort_order);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- The catalogue is public marketing data: anyone may read, nobody may write.
-- Writes happen through the service role key, which bypasses RLS entirely, so
-- no insert/update/delete policy is defined on purpose.
alter table public.stays          enable row level security;
alter table public.stay_images    enable row level security;
alter table public.amenities      enable row level security;
alter table public.stay_amenities enable row level security;

drop policy if exists "stays are publicly readable"          on public.stays;
drop policy if exists "stay images are publicly readable"    on public.stay_images;
drop policy if exists "amenities are publicly readable"      on public.amenities;
drop policy if exists "stay amenities are publicly readable" on public.stay_amenities;

create policy "stays are publicly readable"
    on public.stays for select to anon, authenticated using (true);

create policy "stay images are publicly readable"
    on public.stay_images for select to anon, authenticated using (true);

create policy "amenities are publicly readable"
    on public.amenities for select to anon, authenticated using (true);

create policy "stay amenities are publicly readable"
    on public.stay_amenities for select to anon, authenticated using (true);
