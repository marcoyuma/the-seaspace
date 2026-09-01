# Audit Responsivitas — Seaspace

Dokumen riset (bukan implementasi). Dicatat supaya sesi/agent berikutnya bisa langsung mulai
kerja tanpa explore ulang. Semua className/line number di bawah ini berdasarkan state file
saat audit dijalankan (2026-08-17) — beberapa file terkait sedang berstatus `modified` di git,
jadi cek ulang line number sebelum eksekusi kalau sudah lama.

Urutan kerja yang disepakati: **Bagian A dulu** (3 area yang sudah divalidasi bermasalah),
baru lanjut ke Bagian C (komponen "aman" — belum tentu bermasalah, belum divalidasi).

**Update 2026-08-17**: Sebelum masuk ke perbaikan layout, aturan font untuk teks kecil/body
(non-heading) sudah diselaraskan lebih dulu di seluruh codebase — lihat **Bagian E** di bawah.
Ini sudah "dikunci": ketika mengerjakan Bagian A/C di bawah, className font (size/weight/
tracking/warna) pada teks kecil TIDAK perlu direvisi lagi, cukup pakai preset yang sudah
ditetapkan di Bagian E. Yang masih perlu dikerjakan di Bagian A/C hanyalah className struktural
(grid/flex/width/height/margin/padding) untuk breakpoint mobile/tablet.

## Ringkasan Eksekutif

- Tailwind v4, config berbasis CSS di `app/_styles/globals.css` (bukan `tailwind.config.ts`).
  Breakpoint masih default: `sm:640px` `md:768px` `lg:1024px` `xl:1280px` `2xl:1536px`, tidak
  ada override custom.
- Cuma **6 dari 82 file** yang punya className pakai prefix responsif (`sm:`/`md:`/`lg:`/dst)
  sama sekali. Artinya ini bukan cuma masalah di 3 file yang dicurigai — mayoritas codebase
  memang dibangun single-breakpoint (desktop-only).
- `app/layout.tsx` set `overflowX: hidden` di elemen `<html>`. Ini **menyembunyikan** overflow
  horizontal, bukan menunjukkannya lewat scrollbar — jadi bug overflow gampang lolos kalau
  cuma dicek sekilas tanpa resize browser beneran.
- Ada 1 pola yang **sudah benar** dan bisa dijadikan referensi gaya penulisan:
  `features/stays/components/stay-location-section.tsx:38` →
  `grid-cols-1 gap-4 md:grid-cols-2`.

---

## Bagian A — 3 Area Prioritas (sudah divalidasi bermasalah)

### `ui/parallax-image-section.tsx`
- L36: `h-240` — tinggi section fixed, tidak menyesuaikan viewport pendek/mobile.
- L66 & L69: `text-[96px]` — dua headline ("Here" / "unfold") dipisah kiri-kanan, ukuran raksasa
  tanpa breakpoint. Di 375–428px ini pasti overflow.
- L75: `text-[24px] max-w-198.75` (~795px max-width paragraf) — di layar sempit lebar teks jadi
  tidak proporsional ke section.
- L65: `flex items-center justify-between` untuk 2 headline — tidak akan wrap dengan rapi kalau
  dipaksa muat di layar sempit.

### `ui/footer.tsx`
- L31: `grid-cols-[2fr_1fr_1fr_1fr]` — grid 4 kolom fixed-ratio, tidak collapse ke 1 kolom di
  mobile.
- L106–108: `whitespace-nowrap` + `text-[200px]` (watermark "THE SEASPACE") — overflow parah di
  layar sempit, meski dibungkus `overflow-hidden` di parent `<footer>`.
- L25: `px-16 pt-16 pb-20` — padding fixed, tidak mengecil di mobile.
- L22: merender `<ParallaxImageSection />` langsung sebagai child, jadi masalah di atas ikut
  terbawa satu paket.
- **Dirender global** lewat `app/layout.tsx:73`, di dalam
  `<Suspense><ChromeGate><Footer /></ChromeGate></Suspense>` — footer ini muncul di HAMPIR SEMUA
  halaman (kecuali `/login` dan `/forgot-password`, lihat `ui/chrome-gate.tsx:14`). Ini bukan
  bug 1 halaman, tapi bug situs-lebar.
- Catatan: ada `<ParallaxImageSection />` dan `<Footer />` yang di-comment-out di
  `app/page.tsx:55,58` — dead code, redundant karena Footer sudah global dari layout. Tidak
  perlu disentuh, tapi dicatat biar tidak membingungkan pas baca `app/page.tsx`.

### `features/stays/components/stays-preview-section.tsx`
- L62: `grid grid-cols-2 gap-6` — 2 kolom fixed, tidak collapse ke 1 kolom di mobile.
- L40: `flex justify-between items-start gap-6` untuk teks deskripsi + tombol "Explore stays" —
  tidak wrap.
- Dirender sekali di `app/page.tsx:38`, satu-satunya usage aktif. Komentar eksplisit di
  `app/page.tsx:37`: *"ADA MASALAH DI SINI MENGENAI RESPONSIVITAS HERO IMAGE TIDAK TERCROP"*.
- **Root cause sebenarnya bukan di file ini** — kartu di dalam grid-nya (`StayCardPreview`) yang
  jadi penyebab utama overflow. Lihat di bawah.

### `features/stays/components/stay-card-preview.tsx` (dependency langsung — wajib dibenerin bareng)
- L25: `style={{ width: 600, height: 570 }}` — **inline style, fixed 600×570px, tanpa unit
  relatif sama sekali**. Ini akar masalah "hero image tidak tercrop": 2 kartu 600px berdampingan
  butuh viewport ≥1200px hanya untuk tidak overflow.
- L48–54: pill info floating (`absolute inset-x-3 bottom-3 h-12`) pakai `text-[18px]`/
  `text-[16px]` fixed, `flex justify-between` tanpa `flex-wrap` — nama villa/lokasi panjang di
  layar sempit tidak akan wrap, bisa overflow keluar pill.
- Karena ukurannya inline style (bukan className Tailwind), ini **tidak bisa** langsung
  dioverride pakai `md:`/`lg:` className biasa — perlu direstrukturisasi jadi className atau
  conditional style dulu.

---

## Bagian B — Primitives Bersama (akar sistemik)

Dipakai oleh ketiga area di Bagian A **dan** puluhan section lain. Kalau tetap fixed-size,
benerin section manapun di atasnya percuma karena "bocor" dari sini.

- `ui/container.tsx:7` — `mx-30 mb-25` (margin horizontal fixed 120px tiap sisi + margin bawah
  fixed 100px). Ini wrapper section yang dipakai luas di seluruh `features/`. Di viewport 375px,
  margin 120px×2 cuma nyisain 135px lebar konten.
  - **Catatan silang**: `ui/header.tsx:92` (`px-30`) sengaja meniru angka 120px ini secara
    manual biar align sama Container. Kalau Container diubah, Header harus diubah bareng —
    kalau tidak, posisi logo/nav bakal geser dari konten di bawahnya.
- `ui/heading.tsx:19` — `text-[48px] leading-none`, fixed, tanpa scaling.
- `ui/text.tsx:10` — `text-[18px] ... max-w-128.25` (~513px), fixed.
- `ui/overline-text.tsx:9` — `text-[18px]`, fixed.
- `ui/pill-link.tsx` → delegasi ke `ui/pill-styles.tsx` — sekarang `rounded-full` +
  `PILL_SIZE.md` (`px-6 py-3 text-[16px] leading-6`), masih fixed. Geometrinya sudah
  dikunci dan dipusatkan, lihat **Bagian G**; yang belum ada cuma varian breakpoint-nya.
- `ui/section-heading.tsx:13-17` — duplikat pola fixed yang sama (`text-[48px]`, `text-[18px]`).

---

## Bagian C — Pola Serupa di Tempat Lain (belum diminta, risiko sama — untuk tahap berikutnya)

Dicatat supaya kalau nanti masuk giliran "komponen aman", tidak perlu explore ulang.

- `ui/header.tsx` — L86 `w-190 max-w-[calc(100%-48px)]`; L97/99/103 `w-[calc(100%-240px)]`
  (dua kali) — inset 240px fixed tidak mengecil sesuai layar; di <500px sisa ruang cuma
  ~135px, berpotensi nav/logo/icon tabrakan. Nav (L116) & profile slot (L160) di-`hidden` di
  bawah `lg` (1024px) tanpa fallback `md`/`sm` — hamburger (`MenuPanel`) menutupi ini secara
  fungsional, tapi lebar pill header sendiri tetap berisiko.
- `ui/menu-panel.tsx` — L193 `w-96`/`w-80`, panel 320–384px, mendekati/melebihi lebar viewport
  375px.
- `features/reviews/components/review-carousel.tsx:52` & `reviews-panel.tsx:25` — `w-161`
  (~644px) fixed.
- `features/marketing/spa/components/spa-hero.tsx` & `golf-course/components/golf-hero.tsx`
  (keduanya juga sedang `modified` di git) — `h-190`/`h-80`/`max-w-140`, `grid-cols-2` tanpa
  breakpoint, pola identik di 2 file.
- `features/home/components/family-history-section.tsx` — collage gambar dengan banyak dimensi
  fixed (`w-140 h-103`, `w-84 h-74`, `w-64 h-94`, `w-122 h-72`, `max-w-133`) tanpa breakpoint,
  meski file ini SUDAH punya beberapa prefix responsif di bagian lain (parsial, tidak konsisten).
- `features/home/components/gallery.tsx:442` — `h-[609px]` fixed, dan `w-[1000px]`/`w-[315px]`
  — pola sama dengan `stay-card-preview.tsx`.
- `features/services/components/service-card.tsx:38` — `style={{ width: 385, height: 445 }}`
  inline, ada prop `fluid` yang mem-bypass ini kondisional — perlu dicek apakah caller-nya
  (`service-and-amenities-preview.tsx`) pakai `fluid`.
- `features/services/components/more-service-and-amenities.tsx` — `h-160` (×3, ~640px) fixed.
- `features/stays/components/stay-info-section.tsx:45,81` — `grid-cols-2`/`grid-cols-3` tanpa
  breakpoint.
- `features/stays/components/stay-image-carousel.tsx:19,368` — `w-131` (~524px) fixed.
- `features/experience-requests/components/experience-request-form.tsx:228`,
  `features/booking/components/booking-modal.tsx:199` — `grid-cols-2` tanpa breakpoint (form,
  risiko tinggi di layar sempit).
- `ui/modal.tsx:23,31` — `max-w-140` (~560px).
- `features/home/components/scroll-running-text.tsx:60` — `text-[48px] whitespace-nowrap
  max-w-dvw` — mungkin memang disengaja untuk efek marquee, perlu dikonfirmasi ke pembuat
  aslinya sebelum dianggap bug.

---

## Bagian D — Referensi Pola yang Sudah Benar

- `features/stays/components/stay-location-section.tsx:38` —
  `grid-cols-1 gap-4 md:grid-cols-2` — contoh konkret gaya penulisan responsif yang konsisten
  sama codebase ini (bukan pola dari luar, jadi aman dijadikan template).
- File lain yang sudah pakai prefix responsif (buat dicek pola penulisannya sebelum menulis
  yang baru): `app/(stay-list)/stays/[stayId]/book/page.tsx`,
  `features/home/components/family-history-section.tsx` (sebagian),
  `features/home/components/hero.tsx`, `ui/header.tsx` (sebagian), `ui/menu-panel.tsx`
  (sebagian).

---

## Bagian E — Aturan Font Teks Kecil/Body (sudah diselaraskan & dikonfirmasi, 2026-08-17)

Sebelum masuk perbaikan responsivitas, ditemukan bahwa teks kecil (non-heading) di seluruh
codebase ini tidak konsisten: 98 pemakaian `text-black/N` tersebar di 7 nilai opacity berbeda
(`/50` 54×, `/40` 26×, `/60` 12×, `/30` 5×, `/70` 3×, `/10` 2×, `/25` 1×) untuk peran yang sama
persis — plus beberapa `tracking-[N%]` yang pakai unit persen, unit yang **tidak valid** untuk
CSS `letter-spacing` (browser mengabaikannya, jadi tracking-nya diam-diam sudah 0 tanpa
disadari). Ini sudah diselaraskan lebih dulu (lihat Bagian E.1–E.3), independen dari breakpoint
apa pun — jadi berlaku sama persis di mobile/tablet/desktop, tidak butuh varian `sm:`/`md:`/`lg:`.

### E.1 — Kenapa `black/60`, bukan `black/50` (riset kontras)
`black/50` di atas putih ≈ `#808080`, kontras ~3,95:1 — **gagal** ambang WCAG AA (4,5:1) untuk
teks berukuran 14–18px meskipun ini opacity paling sering dipakai di codebase lama. `black/60`
≈ `#666666`, kontras ~5,74:1 — lolos AA dengan baik, masih terasa abu-abu (bukan hitam pekat),
dan sudah dipakai di 12 tempat sebelumnya jadi bukan warna asing. `black/70` (~7,5:1) terlalu
mendekati hitam solid untuk peran "secondary/muted".

### E.2 — Preset final (berlaku di semua breakpoint — mobile ~375–428px, tablet ~768–1024px,
desktop ~1280px+)

**Preset A — teks muted/secondary** (deskripsi, subtitle, label berpasangan dengan value,
meta info kartu, helper text):
- Warna: `text-black/60`
- Size: `text-[16px]`
- Weight: `font-medium`
- Tracking: `tracking-normal` (semua `tracking-[N%]` invalid sudah diganti)
- Leading: tidak dipaksa satu nilai — tetap kontekstual (`leading-relaxed` untuk paragraf,
  default/`leading-normal` untuk teks satu baris), karena ini bukan bagian dari
  size/weight/tracking yang diminta diselaraskan dan memaksa satu nilai berisiko merusak
  keterbacaan paragraf panjang.

**Preset B — teks solid `text-black` (bukan heading)**, dipasangkan dengan Preset A sebagai
value/label penting (harga, tanggal, total):
- Warna: `text-black` (tetap)
- Size: `text-[16px]`
- Weight: `font-semibold`
- Tracking: `tracking-normal`

### E.3 — Dikecualikan dari preset ini (didokumentasikan, sengaja tidak diseragamkan)
- Elemen UI ruang terbatas/fixed: sel & header kalender (`month-calendar.tsx`), badge status
  (`booking-status-badge.tsx`), label uppercase field super kecil dengan `tracking-wide`
  (`date-field.tsx`, `form-primitives.tsx` LABEL, `<legend>` di `delete-account-dialog.tsx`) —
  dipaksa ke 16px berisiko overflow di container yang sengaja dibuat kecil.
- `OverlineText` (`ui/overline-text.tsx`) — warna teal brand `#0F677D`, peran eyebrow label,
  bukan "abu-abu level di bawah hitam"; hanya bug tracking-nya yang diperbaiki, warna/size tetap.
- Teks dekoratif: marquee `scroll-running-text.tsx` dan watermark "THE SEASPACE" di
  `ui/footer.tsx` (keduanya `black/10`) — ornamen visual, bukan informasi.
- Warna semantik: `text-red-700/800` (error), `text-amber-800/900` (warning) — tidak boleh
  disamakan ke abu-abu netral karena punya makna sendiri.
- `placeholder:text-black/30` — konvensi native browser, beda kategori dari teks yang tampil.
- Nilai berukuran ≥20px (harga besar, angka total, judul kartu) — dianggap teks "emphasis/mini-
  heading", di luar scope "teks kecil"; kalau ada `tracking-[N%]` invalid di sana, bug-nya tetap
  diperbaiki tapi size/weight/warna dibiarkan.
- `ui/header.tsx` nav link & `ui/menu-panel.tsx` `ACTIVE_TINT` — sengaja dilewati karena classnya
  dipakai bersama antara state aktif/tidak-aktif dan berisiko mengubah styling hover/underline
  yang sudah ada; perannya juga lebih dekat ke nav-label ber-tracking daripada teks body biasa.

### E.4 — Cakupan penerapan
- 3 primitive bersama sudah diupdate: `ui/text.tsx`, `ui/section-heading.tsx` (bagian deskripsi),
  `ui/overline-text.tsx` (hanya bug tracking).
- **80 pemakaian `text-black/60`** sekarang tersebar konsisten di seluruh `features/`, `ui/`,
  `app/` (naik dari 12 sebelumnya) — mencakup halaman account, booking, checkout, auth, stays,
  reviews, marketing (spa/golf), experience-requests, check-in.
- Semua `tracking-[N%]` invalid di seluruh repo sudah diganti ke `tracking-normal` (termasuk di
  elemen ≥20px yang di luar scope size/weight/warna).
- `npx tsc --noEmit` bersih setelah seluruh perubahan diterapkan.
- **Tidak ada className struktural (grid/flex/gap/width/height/margin/padding) yang diubah** di
  pass ini — murni font, sesuai batasan yang disepakati.

---

## Bagian F — Aturan Heading Cluster (OverlineText + Heading + Text), sudah diterapkan 2026-08-17

Ditemukan inkonsistensi terpisah dari Bagian A/C: gap antara `OverlineText` → `Heading` →
`Text` di tiap section landing page (`/`) beda-beda (`gap-6` di
`service-and-amenities-preview.tsx`, `gap-6.5` di `gallery.tsx`/`faq-section.tsx`/
`reviews-header.tsx`, dan `stays-preview-section.tsx` malah tidak punya `Text` langsung di
cluster-nya). Ukuran `Heading` juga tidak seragam: default `ui/heading.tsx` adalah
`text-[48px]` tanpa breakpoint, sementara `stays-preview-section.tsx` sempat pakai scaling
custom 4 breakpoint (`28/34/40/44px`) yang sendirian beda dari section lain.

Ini sudah diselaraskan (independen dari Bagian A/C — perubahan di sini murni gap & font-size,
bukan restrukturisasi grid/flex struktural):

### F.1 — Preset final
- **Gap dalam intro block**: `gap-3` (12px) di antara `OverlineText`, `Heading`, dan `Text`
  (dan CTA yang menempel di baris Text, seperti `PillLink` di StaysPreviewSection) ketika
  berurutan langsung sebagai flex children dalam satu wrapper.
- **Gap intro block → konten (image/grid/list/dst)**: `gap-5` (20px) — sedikit lebih lega
  daripada 12px di dalam intro block, karena user melaporkan 12px terasa terlalu mepet ke
  konten (grid kartu, gambar galeri, dll). Ini butuh wrapper terpisah: intro block
  (OverlineText+Heading+Text/CTA) dibungkus satu `<div>` ber-`gap-3`, lalu parent-nya (section
  atau wrapper luar) pakai `gap-5`/`mb-5` antara wrapper itu dan konten berikutnya.
- **Heading-only cluster** (tanpa OverlineText/Text, mis. `MoreServiceAndAmenities`): gap ke
  konten juga **`mb-5`** (20px), bukan `mb-3`, samakan dengan aturan di atas — walau tidak ada
  intra-cluster gap untuk dibedakan di sini.
- **Ukuran heading**: semua `<Heading>` di section landing page dipakai pada ukuran 36px fixed
  di semua breakpoint — tidak ada scaling per-breakpoint lagi.

  > **Sudah digantikan.** Waktu pass ini ditulis, ukurannya ditembak dari className pemanggil
  > memakai modifier `!` untuk mengalahkan default 48px di `ui/heading.tsx`. Cara itu sudah
  > tidak dipakai: ukuran sekarang jadi milik primitifnya lewat prop `size`, dengan
  > `size="section"` (36px) sebagai default. Pemanggil tidak menulis ukuran sama sekali, dan
  > tidak ada lagi modifier `!` di codebase ini — lihat "Tailwind: jangan pakai `!`" di
  > `AGENTS.md`.
- Gap yang BUKAN bagian dari heading cluster (mis. gap grid kartu antar-kartu, gap antar item
  FAQ, gap Text↔PillLink di dalam intro block) **tidak disentuh**.

### F.2 — File yang diupdate
- `features/stays/components/stays-preview-section.tsx` — OverlineText/Heading/div(Text+PillLink)
  dibungkus wrapper `gap-3`; section sendiri pakai `gap-5` antara wrapper itu dan grid kartu.
  Heading: scaling 4-breakpoint diganti 36px fixed.
- `features/services/components/service-and-amenities-preview.tsx` — OverlineText/Heading/Text
  dibungkus wrapper `gap-3`; section pakai `gap-5` ke grid kartu. Heading: 36px fixed.
- `features/home/components/gallery.tsx` — wrapper cluster tetap `gap-3` (OverlineText/Heading/
  Text), wrapper luar (cluster → track gambar) naik ke `gap-5`. Heading: 36px fixed.
- `features/home/components/faq-section.tsx` — wrapper cluster tetap `gap-3`, wrapper luar
  (cluster → daftar FAQ) naik ke `gap-5`. Heading: 36px fixed.
- `features/reviews/components/reviews-header.tsx` — `gap-3` tetap (OverlineText↔Heading,
  cluster ini tidak punya Text), `mb-3` → `mb-5` (heading → `ReviewsPanel` yang jadi sibling
  di `reviews-section.tsx`). Heading: 36px fixed.
- `features/services/components/more-service-and-amenities.tsx` — heading-only (tanpa
  OverlineText/Text), `mb-3` → `mb-5` (heading → grid badge amenities). Heading: 36px fixed.

### F.3 — Dikecualikan dari Bagian F (didokumentasikan, sengaja tidak disentuh)
- `features/home/components/hero.tsx` — `<h1>` custom dengan `clamp()`, sama sekali tidak pakai
  `ui/heading.tsx`/`OverlineText`/`Text`. Sudah fluid-responsive lewat `clamp()`, dan bukan
  bagian dari pola 3-elemen ini — di luar cakupan permintaan.
- `features/home/components/family-history-section.tsx` — heading dianimasikan huruf-per-huruf
  lewat GSAP (`<h1>` custom dengan `ref`), juga tidak pakai `ui/heading.tsx`. Mengubahnya
  berisiko merusak animasi scroll-trigger yang sudah ada; di luar cakupan permintaan ini.
- `ui/heading.tsx` sendiri tidak diubah defaultnya — lihat F.1.

### F.4 — Cakupan
- Perubahan murni: gap (`gap-*`/`mb-*`) dan font-size Heading (36px fixed). Tidak ada
  className struktural lain (grid-cols, flex-direction, width/height) yang diubah di pass ini.
- `npx tsc --noEmit` bersih setelah seluruh perubahan diterapkan.

---

## Bagian G — Aturan Pill (wrapper kapsul), sudah diterapkan 2026-08-27

Sebelum pass ini ada **14 pill berteks** dengan **5 nilai padding horizontal berbeda**
(`px-3`, `px-4`, `px-5`, `px-6`, `px-8`) untuk bentuk yang sebenarnya sama. Label terasa
nempel ke lengkung kapsul di sebagian tempat dan terlalu longgar di tempat lain.

Polanya penting: siapa pun yang menulis pill dengan tangan lalu menakarnya pakai mata
selalu mendarat di `px-6`. Yang masih `px-4` justru primitive bersamanya sendiri
(`ui/pill-styles.tsx`) plus klaster auth/booking yang menyalin dari situ. Jadi nilainya
sudah ditemukan berkali-kali, cuma belum pernah ditulis jadi aturan.

### G.1 — Aturan

> **Padding kiri-kanan pill = setengah tinggi pill = radiusnya.**
> Lalu bulatkan ke langkah Tailwind terdekat.

Dasarnya: pada kapsul, radius selalu setengah tinggi. Material Design 3 menerbitkan spek
tombol kapsulnya (tinggi 32/padding 12, 40/16, 56/24, 96/48, 136/64) dan semuanya jatuh
di **0.375–0.50 × tinggi** — yang untuk kapsul sama saja dengan **0.75–1.0 × radius**.

Catatan jujur soal *kenapa*: secara geometri lengkung kapsul nyaris tidak memakan ruang
di pita vertikal tempat huruf duduk (di pill 48px cuma ~0.7px setinggi teks), jadi
hurufnya tidak benar-benar tertabrak. Yang bikin sesak itu **optik** — mata membaca total
ruang kosong di kedua ujung, dan ujung membulat memangkas ruang itu dibanding ujung
kotak. Karena itu pill butuh padding lebih besar daripada rounded-rect setinggi sama.

### G.2 — Preset final: `PILL_SIZE` di `ui/pill-styles.tsx`

Tinggi = `2 × py + line-height`, jadi tiap baris bisa dicek sendiri:

| Ukuran | Kelas | Tinggi | Radius | px | Rasio px:py |
|---|---|---|---|---|---|
| `sm` | `px-3.5 py-1 text-[14px] leading-5` | 28 | 14 | 14 | 3.5 : 1 |
| `md` | `px-6 py-3 text-[16px] leading-6` | 48 | 24 | 24 | 2 : 1 |
| `lg` | `px-7 py-4 text-[16px] leading-6` | 56 | 28 | 28 | 1.75 : 1 |

`md` adalah default — dipakai `PILL_BASE` dan seluruh CTA. `sm` cuma dipakai
`booking-status-badge.tsx`. `lg` disediakan tapi belum ada pemakainya.

Leading dipatok eksplisit, bukan dibiarkan mewaris: `text-[…]` itu arbitrary value dan
Tailwind v4 tidak memancarkan line-height untuk itu, jadi tanpa patokan tingginya ikut
apa pun yang di-set leluhurnya — dan aturan padding di atas ikut meleset.

**`font-medium` sengaja TIDAK masuk `PILL_SIZE`.** Itu urusan bobot huruf, bukan ukuran;
token ini murni geometri. Pemanggil menambahkannya sendiri.

### G.3 — Aturan turunan

- **Radius** — `rounded-full`, bukan `rounded-[40px]`. Hasilnya identik di semua tinggi
  yang dipakai sekarang (browser meng-clamp 40px jadi setengah tinggi), tapi
  `rounded-full` menyatakan bentuknya jujur dan menjaga hubungan "radius = setengah
  tinggi" yang jadi dasar seluruh aturan ini. Di pill setinggi >80px, `rounded-[40px]`
  diam-diam berhenti jadi kapsul dan aturannya jadi salah.
- **Ikon + teks sebaris** — padding tetap simetris, jarak ikon–teks `gap-2` (8px).
  Satu-satunya pemakai: dua tombol OAuth di `features/auth/components/auth-form.tsx`.
- **Ikon saja** — jangan pakai padding sama sekali; pakai `size-*` persegi
  (`size-8`/`size-9`/`size-10`) + `rounded-full`. Sudah konsisten di codebase.
- **Chip bundar menempel di ujung bar** — trailing padding turun jadi separuh
  (`pl-4 pr-2`), karena lingkaran chip menyumbang inset optiknya sendiri. Sudah benar di
  `stay-card-preview.tsx` dan `service-card.tsx`.
- **Pill ber-`border`** — `box-sizing: border-box` bikin hairline 1px memakan padding,
  jadi ruang dalamnya efektif 23px bukan 24px. Selisih 1px ini **sengaja tidak
  dikompensasi**; dicatat di sini supaya tidak diperdebatkan ulang.

### G.4 — File yang diupdate

`ui/pill-styles.tsx` (`PILL_SIZE` + `PILL_BASE`), lalu 11 pill yang ditulis tangan ikut
mengimpor token itu: `form-primitives.tsx` (`SUBMIT`, kena 5 form), `auth-form.tsx`
(`OAUTH_BUTTON`), `checkout-form.tsx`, `check-in-button.tsx`, `booking-status-badge.tsx`,
`profile-form.tsx`, `sign-out-button.tsx`, `avatar-upload.tsx`,
`delete-account-dialog.tsx` (×2), `travel-option-card.tsx`. Dua override yang jadi tidak
perlu dihapus di `update-password-form.tsx` (`px-6`) dan `experience-request-form.tsx`
(`px-8`).

`travel-option-card.tsx` sekaligus dikasih `font-medium` — satu-satunya pill berteks yang
belum punya.

### G.5 — Dikecualikan (didokumentasikan, sengaja tidak disentuh)

- `stay-image-carousel.tsx` — kapsul rel titik indikator, wadah non-teks.
- `ui/header.tsx` — bar chrome yang jadi kapsul saat menyusut, bukan tombol.
- Tombol ber-radius sedang yang **bukan** kapsul (radius < setengah tinggi), jadi aturan
  "px = radius" tidak berlaku: `rounded-[20px]` di halaman error & not-found,
  `rounded-2xl` di `booking-modal.tsx`, `rounded-[20px]`/`rounded-[25px]` di `hero.tsx`,
  `review-carousel.tsx`, `amenity-badge.tsx`. Keluarga ini masih perlu aturannya sendiri.

### G.6 — Cakupan
- Perubahan murni geometri (padding, radius, leading, satu `gap`). Surface — warna,
  hairline, hover, disabled, animasi rolling label — tidak disentuh sama sekali.
- Arah impor `features/` → `ui/`, sesuai Rule 3 ARCHITECTURE.md.
- Interpolasi template literal di sini aman: nama class **utuh** tertulis sebagai literal
  di dalam `PILL_SIZE` pada file yang dipindai Tailwind. Yang di-interpolasi cuma seluruh
  string jadinya — beda dengan merakit nama dari potongan (`px-${n}`), yang tidak pernah
  dipancarkan Tailwind v4 (lihat peringatan di `ui/heading.tsx`).
- `npx tsc --noEmit`, `npm run lint`, `npm test` (131 tes) dan `npm run build` bersih.
  Kehadiran `px-6`/`px-3.5`/`leading-5` diverifikasi langsung di CSS hasil build.

---

## Urutan Kerja yang Disarankan

1. Benerin `ui/container.tsx` dan primitives di Bagian B lebih dulu (kalau memang mau diubah) —
   atau putuskan dulu apakah primitives ini didesain ulang sekalian atau di-patch per-section.
2. `ui/parallax-image-section.tsx` — headline `text-[96px]` dan tinggi `h-240` butuh varian
   breakpoint.
3. `ui/footer.tsx` — grid 4 kolom dan watermark `text-[200px]`.
4. `stay-card-preview.tsx` — restrukturisasi inline `style={{ width: 600, height: 570 }}` jadi
   className supaya bisa dikasih breakpoint; ini prasyarat sebelum `stays-preview-section.tsx`
   bisa benar-benar responsif, karena grid 2-kolomnya bergantung pada ukuran kartu ini.
5. `stays-preview-section.tsx` — grid + flex header section.
6. Baru lanjut ke Bagian C sesuai prioritas halaman yang paling sering diakses user.
