# Debugging: login gagal total di Vercel, jalan normal di lokal

**Status: root cause terkonfirmasi lewat Vercel Function Logs dan sudah dibereskan sampai ke
akarnya (versi `sharp` disamakan). Lolos verifikasi lokal, menunggu verifikasi di preview
deployment PR sebelum masuk production.**

Dokumen kerja terpisah dari [README.md](README.md) — README itu dokumen "status: built and
working" untuk keadaan normal, dan ada bagian di sana yang klaim OAuth "proven working end to
end". Itu benar untuk pengujian lokal, tapi ternyata tidak berlaku di deployment Vercel.
Daripada mengotori README dengan status yang masih berubah-ubah, catatan debugging ini hidup
sendiri sampai akar masalahnya beres, lalu ringkasannya dipindah ke README.

## Gejala (dikonfirmasi langsung oleh yang deploy, 2026-09-04)

- Di **lokal**: sign-in email/password dan OAuth (GitHub, Google) dua-duanya jalan normal.
- Di **Vercel production**: **dua-duanya gagal total** — bukan cuma OAuth. Browser menampilkan:

  > `Error: An error occurred in the Server Components render. The specific message is
  > omitted in production builds to avoid leaking sensitive details. A digest property is
  > included on this error instance which may provide additional details about the nature of
  > the error.`

  Ini pesan generik bawaan Next.js untuk exception yang tidak tertangkap saat render App
  Router di production — bukan pesan yang ditulis sendiri oleh kode auth di sini. Kode auth
  di repo ini (`describeAuthError`, redirect ke `/login?error=oauth_failed`, dst.) selalu
  menerjemahkan kegagalan jadi pesan yang jelas ke pengguna — kalau yang muncul malah pesan
  generik ini, artinya crash-nya terjadi *sebelum* logic penanganan error itu sempat jalan.

## Kenapa dua jalur yang independen bisa gagal bareng

Email/password dan OAuth secara logika tidak saling bergantung — beda validasi, beda call ke
Supabase. Tapi keduanya **hidup di satu file `"use server"` yang sama**:
[server-actions.ts](server-actions.ts). Setiap export di file `"use server"` di-bundle sebagai
satu unit; kalau ada satu `import` di level atas file itu yang gagal dimuat, **seluruh file
gagal**, dan setiap action di dalamnya — `signIn`, `signUp`, `signInWithProvider`, semuanya —
ikut mati dengan gejala yang identik. Itulah kenapa dua jalur yang "seharusnya" independen
malah gagal bareng dengan pesan yang sama persis.

## Hipotesis utama: `import sharp` di baris atas `server-actions.ts`

```ts
// server-actions.ts baris 1-8
"use server";
...
import sharp from "sharp";
```

`sharp` cuma dipakai di satu fungsi, `uploadAvatar` (resize foto profil yang diupload manual).
Tapi karena importnya tanpa syarat di level modul, kegagalan memuat `sharp` meracuni seluruh
file — persis skenario di atas.

**Kenapa ini gampang gagal khusus di Vercel:** `sharp` punya native binary per-platform
(lewat `optionalDependencies`, misal `@img/sharp-darwin-arm64` untuk Mac, `@img/sharp-linux-x64`
untuk Linux). Di lokal (macOS) binary yang cocok otomatis ke-install dan dimuat. Di Vercel
(Linux serverless), kalau binary yang sesuai tidak ikut ter-*trace* dengan benar ke output
function-nya, `sharp` gagal `require` — ini isu yang sudah sangat dikenal di kombinasi
pnpm + sharp + Vercel. Yang bikin ini menjebak: kegagalannya baru muncul saat *runtime*
(saat function dipanggil), bukan saat build — jadi deployment tetap terlihat "sukses" sampai
ada request yang benar-benar menyentuh `server-actions.ts`.

Next.js versi ini (`16.2.3`) sudah otomatis meng-external-kan `sharp` dari bundling Server
Components secara default (`serverExternalPackages` bawaan — dicek langsung di
`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`,
`sharp` ada di daftarnya). Jadi ini bukan soal `next.config.ts` kurang konfigurasi — dugaannya
lebih ke sisi install/tracing binary native di build Vercel.

## Akar masalahnya: dua versi `sharp` hidup bareng

Dugaan "lockfile agak kotor" ternyata bukan petunjuk sampingan — itu penyebabnya. `pnpm why
sharp` menunjukkan dua versi ter-install sekaligus:

| Versi | Dari mana | Butuh libvips |
|---|---|---|
| `sharp@0.34.5` | optional dependency bawaan `next@16.2.3` sendiri | `1.2.4` |
| `sharp@0.35.3` | `package.json` kita | `1.3.2` → **`libvips-cpp.so.8.18.3`** |

File tracing Vercel (`@vercel/nft`) punya penanganan khusus untuk `sharp`, ditulis mengikuti
versi yang dibawa Next sendiri (0.34.x). Versi 0.35 mengubah bentuk dependency-nya — libvips
naik ke 1.3.x dan muncul paket baru `@img/colour` — sehingga `.node`-nya ikut ter-copy ke
lambda tapi `libvips-cpp.so.8.18.3` yang dibutuhkannya **tidak**. Persis bunyi errornya.

Perbaikannya: samakan versi kita ke `^0.34.5`, supaya cuma ada satu sharp dan satu libvips —
versi yang memang sudah dikenal tracing-nya Next. Aman karena `sharp` cuma dipakai di satu
tempat di seluruh repo (`uploadAvatar`), dan API yang dipakai (`.resize()`, `.webp()`,
`.toBuffer()`) identik di 0.34 dan 0.35.

## Dugaan sekunder: config OAuth belum diupdate untuk domain Vercel

README sudah menandai ini di bagian Prerequisites: Site URL & Redirect URLs di Supabase
Dashboard, dan Authorized JavaScript origins di Google Cloud Console, **harus diupdate manual
tiap kali domain deployment berubah** — defaultnya cuma `http://localhost:3000`.

**Ini tetap perlu dicek**, tapi diturunkan prioritasnya sebagai penyebab *utama* karena tidak
bisa menjelaskan kenapa email/password ikut gagal — jalur itu sama sekali tidak menyentuh
redirect_to, Site URL, atau provider apa pun. Kemungkinan besar ini penyebab yang **berbeda
dan independen**, yang baru kelihatan lagi setelah `sharp` (dugaan utama) beres.

## Checklist verifikasi (urutkan begini)

- [x] **1. Baca Vercel Function Logs.** Dikonfirmasi lewat `vercel logs --environment
      production --status-code 500 --expand`. Isi log persis sesuai dugaan:

      ```
      POST /login
      Error: Failed to load external module sharp-082938d0e89fa003: Error: Could not load
      the "sharp" module using the linux-x64 runtime
      ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file:
      No such file or directory
      ```

      Native binary `sharp` gagal dimuat di runtime Vercel — root cause terkonfirmasi, bukan
      lagi dugaan.
- [x] **2. Isolasi kegagalan:** `import sharp from "sharp"` di level modul `server-actions.ts`
      dihapus, diganti dynamic import di dalam `uploadAvatar`. Kegagalan load `sharp` sekarang
      tertangkap lokal di fungsi itu dan tidak lagi menjatuhkan `signIn`, `signUp`,
      `signInWithProvider`, dst.
- [x] **3. Akar masalah dibereskan:** `sharp` di `package.json` diturunkan `^0.35.3` →
      `^0.34.5`, menyamai versi yang sudah dibawa `next@16.2.3` sendiri. `pnpm why sharp`
      sekarang menjawab "Found 1 version of sharp", dan `libvips-linux-x64@1.3.2` (yang
      `.so`-nya hilang di Vercel) sudah tidak ada lagi di lockfile.
- [x] **4. Pesan gagal dibikin jujur:** load `sharp` dipisah dari blok decode. Kalau modulnya
      yang tidak bisa dimuat, dicatat lewat `logAuthError("uploadAvatar:sharp", ...)` dan tamu
      dapat pesan "Photo uploads are unavailable right now" — bukan lagi dituduh menaruh file
      yang bukan foto.
- [x] **5. Verifikasi lokal:** `tsc --noEmit` bersih, `pnpm build` sukses (semua route tetap
      `◐ Partial Prerender`), `pnpm test` 135/135 lolos, dan re-encode nyata pakai sharp 0.34.5
      diuji langsung lewat Node — `mod.default` terbukti callable, bukan namespace.
- [ ] **6. Verifikasi di preview deployment PR** (bukan production): login email/password,
      login GitHub + Google, ganti foto profil di `/account`, lalu
      `vercel logs --environment preview --level error` harus bersih dari `ERR_DLOPEN_FAILED`.
- [ ] **7. Setelah PR di-merge:** ulangi verifikasi di production
      (`the-seaspace-seven.vercel.app`).
- [ ] **8. Cek Supabase Dashboard → Authentication → URL Configuration** — Site URL & Redirect
      URLs sudah mencakup domain production Vercel (bukan cuma `localhost`). **Belum pernah
      dicek** dan bisa bikin OAuth gagal secara terpisah walaupun `sharp` sudah beres.
- [ ] **9. Cek Google Cloud Console → Authorized JavaScript origins** sudah mencakup domain
      production Vercel juga.

## Tabel tracking perubahan

| Tanggal | Apa yang diubah/dicek | Hasil / temuan | Catatan |
|---|---|---|---|
| 2026-09-04 | Analisis awal dari baca kode (tanpa eksekusi) | Hipotesis utama: `import sharp` di `server-actions.ts:8` meracuni seluruh file di runtime Vercel | Belum diverifikasi lewat log — lihat checklist di atas |
| 2026-09-04 | Login & link `vercel` CLI, tarik `vercel logs --environment production --status-code 500` | **Terkonfirmasi**: `POST /login` gagal karena `ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3` saat load `sharp` | Root cause fix, bukan lagi dugaan |
| 2026-09-04 | Merge PR #3 lalu rebuild production, error masih sama | Yang ter-merge itu `feat/landing-preloader`, **bukan** branch fix-nya — `origin/main` masih punya `import sharp` di baris 8 | Bukan fix yang gagal, tapi fix yang belum pernah ikut ter-deploy |
| 2026-09-04 | `package.json`: `sharp` `^0.35.3` → `^0.34.5`, regenerasi lockfile | `pnpm why sharp` jadi "Found 1 version"; libvips `1.3.2` hilang dari lockfile | Menyamai versi yang dibawa `next` sendiri, yang dikenal file-tracing Vercel |
| 2026-09-04 | Pisahkan gagal-load dari gagal-decode di `uploadAvatar`, pakai `logAuthError` | Kegagalan infra sekarang kelihatan di log, pesan ke tamu tidak lagi menyesatkan | — |
| 2026-09-04 | `tsc --noEmit`, `pnpm build`, `pnpm test`, uji re-encode langsung via Node | Semua lolos; 135/135 test, build semua route tetap `◐ Partial Prerender` | Siap di-push sebagai PR untuk diverifikasi di preview deployment |
| 2026-09-04 | Edit `features/auth/server-actions.ts`: `import sharp` di level modul → dynamic `import("sharp")` di dalam `uploadAvatar` | `npx tsc --noEmit` bersih | Belum di-deploy ulang ke Vercel untuk verifikasi live |
| 2026-09-04 | `pnpm why sharp` | Ketemu 2 versi sharp ter-install: `0.34.5` (bawaan `next`) dan `0.35.3` (punya kita) | Dicatat sebagai follow-up #6 — kemungkinan penyebab libvips versi salah yang ke-trace, avatar upload bisa masih rusak di production sampai ini dibereskan |

Update baris baru tiap kali ada langkah checklist yang dijalankan, ada perubahan kode, atau
ada temuan baru — supaya riwayat debugging ini tidak hilang di scrollback chat.
