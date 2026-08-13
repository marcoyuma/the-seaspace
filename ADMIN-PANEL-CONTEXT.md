# Seaspace — konteks untuk codebase admin panel

> Dokumen ini ditulis **untuk repo lain**: aplikasi admin panel yang mengelola data villa.
> Pembacanya (developer maupun AI agent) tidak punya akses ke repo situs customer, jadi
> semua yang perlu diketahui ada di sini — tidak ada rujukan ke file yang tidak bisa Anda buka.
>
> Terakhir diverifikasi terhadap database live: **2026-08-12**.
>
> **⚠️ Database sudah bertambah sejak dokumen ini pertama ditulis.** Bagian
> "Kontrak data" di bawah masih menjelaskan **empat tabel katalog** saja. Sejak
> itu ada tiga tabel lagi — `public.reviews`, `public.guests`, dan
> `public.bookings` — plus bucket `guests`. Ketiganya **di luar wewenang admin
> panel**; baca [Batas wewenang admin panel](#batas-wewenang-admin-panel) sebelum
> menulis apa pun, karena bekerja dari kontrak yang usang berarti menulis ke
> skema yang salah.
>
> **`bookings` juga mengubah apa yang boleh Anda hapus.** Villa yang pernah
> dipesan tidak bisa lagi di-DELETE — lihat
> [Villa yang punya booking tidak bisa dihapus](#villa-yang-punya-booking-tidak-bisa-dihapus).

## Daftar Isi

- [Peta sistem](#peta-sistem)
- [Batas wewenang admin panel](#batas-wewenang-admin-panel)
- [Villa yang punya booking tidak bisa dihapus](#villa-yang-punya-booking-tidak-bisa-dihapus)
- [Kenapa perubahan Anda tidak langsung terlihat customer](#kenapa-perubahan-anda-tidak-langsung-terlihat-customer)
- [Kontrak data — skema tabel](#kontrak-data--skema-tabel)
- [⚠️ Kontrak upload gambar](#-kontrak-upload-gambar)
- [Kontrak revalidasi](#kontrak-revalidasi)
- [Yang tidak bisa dilakukan admin panel](#yang-tidak-bisa-dilakukan-admin-panel)
- [Cara menguji dari sisi Anda](#cara-menguji-dari-sisi-anda)

---

## Peta sistem

Dua aplikasi, satu database. Keduanya **tidak saling import apa pun** — Supabase adalah
satu-satunya titik temu.

```
┌──────────────────────┐         ┌──────────────────────┐
│  Situs customer      │         │  Admin panel         │
│  Next.js 16, Vercel  │         │  (repo Anda)         │
│  READ-ONLY           │         │  READ-WRITE          │
│  anon/publishable key│         │  service role key    │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           │   ┌────────────────────────┐   │
           └──▶│  Supabase              │◀──┘
               │  Postgres + Storage    │
               └────────────────────────┘
```

Situs customer hanya membaca. RLS di keempat tabel katalog **hanya mengizinkan `SELECT`**
untuk anon — tidak ada policy INSERT/UPDATE/DELETE sama sekali. Karena itu admin panel wajib
memakai **service role key**, yang mem-bypass RLS.

> **Service role key tidak boleh menyentuh browser.** Ia setara akses penuh ke database.
> Semua tulisan harus lewat sisi server admin panel (route handler / server action /
> backend), bukan dari kode yang dikirim ke klien.

---

## Batas wewenang admin panel

Ditetapkan pemilik proyek, dan ini **keputusan produk**, bukan sekadar keadaan sementara:

> **Admin panel tidak membuat akun. Tidak membuat guest. Tidak membuat booking.**
> Akun sepenuhnya tanggung jawab user yang ingin memesan.
>
> Admin panel akan disesuaikan dengan aplikasi customer belakangan, dan penyesuaian itu didahului
> riset tersendiri. Sampai riset itu selesai, jangan mengasumsikan wewenang apa pun di luar
> katalog villa.

### Wewenang admin panel

| Boleh ditulis | Tidak boleh disentuh |
|---|---|
| `stays`, `stay_images`, `amenities`, `stay_amenities` | `auth.users` |
| bucket `stays` | `public.guests`, bucket `guests` |
| | `public.reviews` |
| | `public.bookings` |

### Kenapa, dan apa yang rusak kalau dilanggar

**`public.guests` hanya lahir dari trigger signup.** Primary key-nya **adalah** `auth.users.id` —
satu identitas, bukan dua yang bisa melenceng. Baris `guests` dibuat oleh trigger
`on_auth_guest_confirmed` saat `email_confirmed_at` terisi, dan tidak oleh jalur lain mana pun.

Menyisipkan baris `guests` secara manual dari admin panel **mustahil tanpa membuat akun lebih
dulu**, karena foreign key-nya menolak uuid yang tidak ada di `auth.users`. Kalaupun akunnya ikut
dibuat lewat admin API, hasilnya adalah akun yang tidak pernah dimiliki siapa pun — dan seluruh
alasan desainnya (tamu tidak pernah ada sebelum akunnya) runtuh.

**`public.reviews` ditulis tamu, bukan admin.** Setiap baris menunjuk `guests.id`, dan sebuah
review yang tidak berasal dari tamu sungguhan menghilangkan seluruh maknanya. Moderasi (menyembunyikan
atau menolak review) belum dirancang; kalau nanti dibutuhkan, itu kolom status baru — **bukan**
izin menulis baris.

**`public.bookings` ditulis tamu lewat checkout, bukan admin.** Jalur checkout itu sendiri belum
dibangun; sampai ada, satu-satunya isi tabel adalah data seed. Tabelnya juga tidak punya policy
INSERT/UPDATE/DELETE sama sekali, jadi setiap tulisan hanya mungkin lewat service role — bukan
izin, melainkan ketiadaan penghalang. Jangan memakainya.

**Kalau arah ini berubah** — misalnya admin suatu hari boleh mendaftarkan tamu untuk booking
telepon — maka `guests` harus dirombak lebih dulu: primary key sendiri plus `auth_user_id` yang
nullable. Itu perubahan skema, bukan perubahan izin, dan harus dikerjakan di repo situs customer
sebelum admin panel menulis apa pun ke sana.

### Villa yang punya booking tidak bisa dihapus

**Ini akan muncul sebagai error di admin panel, jadi tangani sebagai aturan bisnis, bukan bug.**

`bookings.stay_id` memakai `on delete restrict`. Artinya:

```sql
delete from stays where slug = 'riverside-stone-lodge';
-- ERROR: update or delete on table "stays" violates foreign key constraint
--        "bookings_stay_id_fkey" on table "bookings"
```

Villa yang **belum pernah** dipesan tetap bisa dihapus persis seperti sekarang. Yang diblokir
hanya villa yang punya minimal satu baris booking.

**Kenapa bukan cascade.** Booking adalah catatan keuangan yang umumnya wajib disimpan untuk
keperluan pajak. Cascade akan menghapusnya bersama villanya — persis alasan yang sama yang
membuat `bookings.guest_id` memakai `on delete set null` alih-alih cascade. Dan `set null` juga
ditolak di sini: catatan keuangan yang tidak bisa menjawab "menginap di mana" tidak ada gunanya
sebagai catatan.

**Konsekuensi yang belum terselesaikan, dan ini pekerjaan repo situs customer, bukan Anda.**
`stays` tidak punya kolom yang berarti "tidak lagi bisa dipesan" — hanya `is_new` dan
`is_featured`. Jadi hari ini tidak ada cara melepas villa yang sudah pernah dipesan dari situs
tanpa menghapusnya, dan menghapusnya diblokir. Kalau admin panel membutuhkan itu, mintalah
kolom `is_listed`/`archived_at` ditambahkan di sisi situs customer; jangan mengakalinya dengan
menghapus baris `bookings` lebih dulu, karena itu justru menghancurkan hal yang dilindungi
constraint ini.

---

## Kenapa perubahan Anda tidak langsung terlihat customer

**Ini bagian yang paling sering disalahpahami saat testing. Baca sebelum melapor bug.**

Situs customer di-prerender dan hasilnya di-cache. Setelah Anda menyimpan perubahan di admin
panel, **customer masih melihat data lama sampai cache-nya disegarkan.** Itu desain, bukan bug.

Ekspektasi waktu saat ini:

| Kondisi | Lag admin → customer |
|---|---|
| **Sekarang** (hanya time-based) | maksimal **1 jam** |
| Setelah webhook dipasang (belum) | hitungan **detik** |

### Kenapa tidak dibuat selalu segar saja?

Karena situs customer adalah halaman marketing berat gambar yang tujuannya cepat. Mematikan
cache berarti setiap kunjungan halaman memicu query database (±113 ms terukur) untuk data
yang berubah paling sering beberapa kali seminggu. Itu menukar kecepatan yang dirasakan
ribuan pengunjung demi kesegaran yang dibutuhkan satu admin.

### Kenapa tidak on-demand saja (webhook), tanpa timer?

Karena Supabase Database Webhook berjalan di atas `pg_net`, yang bersifat **fire-and-forget**.
Kalau satu webhook gagal terkirim — situs sedang re-deploy, network blip, secret sudah
dirotasi tapi lupa diperbarui — dan timer dimatikan, maka data **basi selamanya tanpa alarm
apa pun**. Tidak ada yang memberi tahu Anda.

### Karena itu: hybrid

- **On-demand (webhook)** = jalur cepat. Perubahan tampil dalam hitungan detik.
- **Time-based 1 jam** = jaring pengaman. Kalau webhook gagal, sistem sembuh sendiri.

Timer bukan redundansi yang bisa dibuang — ia yang mengubah "gagal senyap selamanya" menjadi
"terlambat maksimal 1 jam".

> **Status saat ini: webhook BELUM dibangun.** Satu-satunya mekanisme hari ini adalah timer
> 1 jam. Jangan menunggu invalidasi instan — ia belum ada.

---

## Kontrak data — skema tabel

Empat tabel. Semua nama kolom `snake_case`.

### `stays`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `bigint` identity | PK internal. **Tidak pernah muncul di URL.** |
| `created_at` | `timestamptz` | default `now()` |
| `slug` | `text` unique | **Segmen URL publik**: `/stays/{slug}` |
| `name` | `text` | |
| `location` | `text` | mis. `"Canggu, Bali"` — situs memakai bagian sebelum koma untuk teks "by car" |
| `price_per_night` | `integer` | **Rupiah bulat**, bukan sen. `2800000` = Rp2.800.000 |
| `discount` | `integer` | Rupiah bulat. **Belum dirender di UI mana pun** |
| `capacity` | `smallint` | jumlah tamu |
| `beds` | `smallint` | |
| `area` | `smallint` | m² |
| `is_new` | `boolean` | menampilkan badge "New" di kartu |
| `is_featured` | `boolean` | **menentukan 2 kartu di landing page** |
| `description` | `text` | paragraf panjang, ditampilkan utuh |
| `bed_type_label` | `text` | mis. `"Superking"` |
| `bed_type_note` | `text` **nullable** | mis. `"Crib on request"` |
| `capacity_label` | `text` | teks bebas, mis. `"4 adults and 2 children"` |
| `lat` / `lng` | `numeric(9,6)` | pin peta Leaflet |
| `airport_code` / `airport_city` | `text` | membentuk link Google Flights |

**Constraint yang akan menolak tulisan Anda** — tangani sebagai validasi form, bukan sebagai
error tak terduga:

| Constraint | Aturan |
|---|---|
| `stays_slug_format` | `^[a-z0-9]+(-[a-z0-9]+)*$` — huruf kecil, angka, tanda hubung. Tanpa spasi/kapital |
| `stays_price_pos` | `price_per_night > 0` |
| `stays_discount_ok` | `discount >= 0 AND discount < price_per_night` |
| `stays_capacity_pos` | `capacity`, `beds`, `area` semuanya `> 0` |
| `stays_lat_range` / `stays_lng_range` | lat −90..90, lng −180..180 |

> ⚠️ **Mengubah `slug` = mengubah URL publik.** Link yang sudah dibagikan atau ter-index
> Google akan 404. Kalau admin panel mengizinkan rename, minimal beri peringatan; idealnya
> kunci setelah villa dipublikasikan.

### `stay_images`

| Kolom | Tipe | Catatan |
|---|---|---|
| `stay_id` | `bigint` FK → `stays.id` | `ON DELETE CASCADE` |
| `storage_path` | `text` unique | **relatif ke bucket**, bukan URL penuh |
| `alt` | `text` **wajib** | teks alt aksesibilitas |
| `blur_data_url` | `text` | lihat kontrak upload di bawah |
| `width` / `height` | `integer` | dimensi **setelah** resize |
| `sort_order` | `smallint` | unique per stay. **`0` = gambar cover** |

Situs merakit URL publiknya sendiri:
`{SUPABASE_URL}/storage/v1/object/public/stays/{storage_path}`
Jangan simpan URL penuh di kolom itu — pindah project/region akan membatalkannya.

### `amenities` + `stay_amenities`

| `amenities` | Tipe | Catatan |
|---|---|---|
| `slug` | `text` unique | format sama dengan slug stay |
| `label` | `text` | judul baris yang bisa dibuka |
| `detail` | `text` | isi yang muncul saat dibuka |
| `is_shared` | `boolean` | fasilitas yang dimiliki **semua** villa |

| `stay_amenities` | Catatan |
|---|---|
| PK `(stay_id, amenity_id)` | |
| `sort_order` | **0–9 khusus villa, 10+ shared.** Situs merender sesuai urutan ini |

**Kenapa `is_shared` penting:** enam fasilitas (housekeeping, wifi, kitchen,
air-conditioning, safe, airport-transfer) memakai **satu baris yang dipakai bersama**
keempat villa. Mengedit teks Wi-Fi sekali akan mengubahnya di semua villa — itu memang
tujuannya. Jangan menduplikasi baris shared per villa; keanggotaannya tetap eksplisit di
`stay_amenities`, jadi sebuah villa boleh tidak memilikinya.

**Villa baru tidak otomatis mendapat fasilitas shared.** Admin panel harus menyisipkan baris
`stay_amenities` untuk keenamnya, atau villa baru akan tampil tanpa fasilitas dasar.

---

## ⚠️ Kontrak upload gambar

**Ini bagian yang paling mudah dilanggar, dan pelanggarannya tidak membuat halaman jelek —
membuatnya error.**

Situs customer merender setiap foto villa dengan `<Image placeholder="blur">`. Di Next.js,
`placeholder="blur"` pada gambar **remote** mewajibkan `blurDataURL`; tanpa itu render
**melempar error**, bukan sekadar menghilangkan efek blur. Gambar statis mendapatkannya
otomatis saat build — gambar dari Storage tidak.

Artinya: **setiap baris `stay_images` yang Anda tulis wajib mengisi `blur_data_url`,
`width`, dan `height`.** Baris tanpa itu akan merusak halaman villa.

### Pipeline yang harus direplikasi

Foto yang ada sekarang di-upload sekali oleh script sekali-pakai yang **sudah dihapus**
bersama foto sumbernya — jadi dokumen ini adalah satu-satunya catatan pipeline-nya yang
tersisa. Admin panel perlu melakukan hal yang sama untuk setiap upload:

1. **Resize** sisi terpanjang ke maksimal **2560 px**, tanpa upscale.
2. **Terapkan orientasi EXIF lalu buang tag-nya** (`sharp().rotate()` tanpa argumen). Tanpa
   ini, foto portrait dari ponsel akan tersimpan miring — WebP membuang tag EXIF yang tadinya
   diandalkan browser.
3. **Encode WebP quality 80.** Situs meminta `quality={80}` ke image optimizer-nya agar cocok;
   sumber yang lebih tinggi hanya membuang byte.
4. **Catat `width`/`height` dari hasil resize**, bukan dari file asli.
5. **Buat blur**: salinan selebar **16 px**, WebP quality 20, jadikan
   `data:image/webp;base64,…`. Hasilnya ±115–220 karakter. Jangan lebih besar — string ini
   dikirim inline di HTML setiap halaman.
6. **Upload** dengan `cacheControl: "31536000"` dan `contentType: "image/webp"`.

Contoh dengan `sharp` (Node):

```js
const resized = sharp(input).rotate().resize({
    width: 2560, height: 2560, fit: "inside", withoutEnlargement: true,
});
const { data, info } = await resized.webp({ quality: 80 }).toBuffer({ resolveWithObject: true });

const blur = await sharp(input).rotate().resize({ width: 16 }).webp({ quality: 20 }).toBuffer();

// info.width / info.height → kolom width / height
// `data:image/webp;base64,${blur.toString("base64")}` → kolom blur_data_url
```

### Konvensi path dan setelan bucket

Path: `{stay_slug}/{sort_order}-{peran}.webp` — mis. `tuscan-twilight-villa/0-exterior.webp`.

Bucket `stays` (terverifikasi live):

| Setelan | Nilai |
|---|---|
| public | `true` |
| `file_size_limit` | **2 MB** |
| `allowed_mime_types` | `image/webp`, `image/jpeg`, `image/png`, `image/avif` |

Kedua batasan itu ditegakkan **oleh Storage**, bukan oleh validasi aplikasi. Upload di luar
batas ditolak dengan error dari Supabase — tangani dan tampilkan ke admin, jangan biarkan
gagal senyap. Pipeline di atas menghasilkan ±60–690 KB per file, jadi jauh di bawah batas.

### Menghapus gambar

Menghapus baris `stay_images` **tidak** menghapus objek di Storage. Hapus keduanya, atau
bucket akan terisi file yatim yang tetap ditagih.

---

## Kontrak revalidasi

> **Status: belum dibangun.** Bagian ini adalah spesifikasi yang disepakati untuk saat
> endpoint-nya dibuat di sisi situs customer. Sampai itu ada, satu-satunya mekanisme adalah
> timer 1 jam.

Saat aktif nanti:

| Hal | Nilai |
|---|---|
| Cache tag | `stays` — satu tag untuk semua: listing, featured, gambar, amenity |
| Pemicu | **Supabase Database Webhook**, bukan panggilan dari admin panel |
| Autentikasi | Shared secret di HTTP header (tidak ada HMAC bawaan seperti Stripe) |
| Method | `POST` saja |

### Kenapa admin panel sebaiknya TIDAK memanggil endpoint-nya sendiri

Terdengar lebih langsung, tapi lebih rapuh. Database Webhook dipicu oleh **perubahan baris**,
jadi ia menangkap **semua** jalur tulis:

- perubahan lewat admin panel ✓
- perbaikan manual lewat Supabase SQL Editor ✓
- script upload gambar di sisi situs customer ✓
- migrasi atau perbaikan data apa pun ✓

Panggilan dari admin panel hanya menangkap jalurnya sendiri. Begitu ada orang menyentuh data
lewat cara lain, cache jadi salah tanpa ada yang sadar.

**Konsekuensi untuk Anda:** admin panel **tidak perlu melakukan apa-apa** soal revalidasi.
Cukup tulis ke database. Konfigurasi webhook dikerjakan sekali di dashboard Supabase.

### Catatan pengelolaan secret

Secret akan hidup di dua tempat: environment situs customer dan konfigurasi webhook di
dashboard Supabase. Rotasi harus mengubah **keduanya** — kalau hanya satu, webhook gagal
senyap. Inilah persis skenario yang membuat timer 1 jam tetap dipertahankan.

---

## Yang tidak bisa dilakukan admin panel

| Tidak bisa | Kenapa |
|---|---|
| `import { revalidateTag } from "next/cache"` | Khusus runtime Next.js. Tidak berfungsi dari aplikasi lain, bahkan kalau admin panel juga Next.js — cache-nya milik proses yang berbeda |
| `updateTag()` | Hanya bisa dipanggil dari Server Action di aplikasi yang sama |
| Menulis dengan anon key | RLS hanya mengizinkan `SELECT`. Wajib service role |
| Mengandalkan `id` numerik di URL | Situs merutekan berdasarkan `slug` |
| Membuat akun, guest, atau booking | Keputusan produk — lihat [Batas wewenang admin panel](#batas-wewenang-admin-panel). Akun adalah tanggung jawab user yang memesan |
| Menulis ke `public.guests` / `public.reviews` / `public.bookings` / bucket `guests` | Di luar wewenang. `guests` hanya lahir dari trigger signup; `reviews` dan `bookings` ditulis tamu |
| Menghapus villa yang punya booking | `bookings.stay_id` memakai `on delete restrict` — [penjelasan lengkap](#villa-yang-punya-booking-tidak-bisa-dihapus) |

Satu-satunya jalur komunikasi antar kedua aplikasi adalah **database** dan (nanti) **satu
HTTP endpoint**.

---

## Cara menguji dari sisi Anda

Tanpa akses ke repo situs customer, ini yang bisa diperiksa:

**Apakah baris gambar lengkap?** Harus mengembalikan 0 baris — kalau tidak, halaman villa
terkait akan error:

```sql
select stay_id, storage_path
from stay_images
where blur_data_url is null or width is null or height is null;
```

**Apakah setiap villa punya cover?** Harus 0 baris:

```sql
select slug from stays s
where not exists (
    select 1 from stay_images i where i.stay_id = s.id and i.sort_order = 0
);
```

**Apakah villa baru mendapat fasilitas shared?** Harus 6 untuk setiap villa:

```sql
select s.slug, count(*) filter (where a.is_shared) as shared_count
from stays s
left join stay_amenities sa on sa.stay_id = s.id
left join amenities a on a.id = sa.amenity_id
group by s.slug order by shared_count;
```

**Apakah gambar benar-benar bisa diakses publik?** Gunakan GET, **bukan** `curl -I` —
Supabase Storage melayani HEAD lewat jalur berbeda yang selalu membalas `no-cache` dan
membuat objek yang sehat terlihat rusak:

```bash
curl -s -o /dev/null -D - \
  "https://<project-ref>.supabase.co/storage/v1/object/public/stays/<path>.webp"
# harap: 200, content-type: image/webp, cache-control: public, max-age=31536000
```

**Apakah webhook terkirim?** (setelah dibangun) — pg_net mencatat setiap respons:

```sql
select created, status_code, error_msg
from net._http_response
order by created desc
limit 20;
```

---

## Ringkasan invariant

Hal-hal yang kalau dilanggar akan merusak situs customer:

1. Setiap `stay_images` punya `blur_data_url`, `width`, `height` — **kalau tidak, halaman error**
2. Setiap stay punya tepat satu gambar dengan `sort_order = 0`
3. `slug` mengikuti `^[a-z0-9]+(-[a-z0-9]+)*$` dan stabil setelah dipublikasikan
4. `price_per_night` dalam rupiah bulat, bukan sen
5. Villa baru diberi keenam fasilitas `is_shared` secara eksplisit
6. Objek Storage dihapus bersama baris `stay_images`-nya
