# Auth — Supabase Auth in the application layer

**The single document for auth.** It absorbed the former `EMAIL-AND-OAUTH.md` and
`SIGNUP-FIX.md`, which had drifted into contradicting each other about one dashboard toggle.

**Status: built and working.** Sign in, register with email and password, or sign in with
GitHub or Google. **Email confirmation is OFF** and password reset is built but not offered —
this project has no working mail sender. Both are one toggle away from returning; see
[Email confirmation](#email-confirmation-currently-off).

The database half was finished first — see [GUEST_PLANNING_TABLE.md](../../GUEST_PLANNING_TABLE.md)
and [supabase/README.md](../../supabase/README.md).

Everything here follows one rule: **no account, no guest.** `guests.id` *is* `auth.users.id`,
so a guest can never exist without an account, and there is no "claim your profile" step to
attack.

## Contents

- [Files](#files)
- [The three clients](#the-three-clients)
- [Session lifecycle](#session-lifecycle)
- [Why `getClaims()` and not `getSession()`](#why-getclaims-and-not-getsession)
- [Sign-up is a contract with a database trigger](#sign-up-is-a-contract-with-a-database-trigger)
- [Rendering: why this needed Cache Components](#rendering-why-this-needed-cache-components)
- [The `next` parameter](#the-next-parameter)
- [Email confirmation: currently OFF](#email-confirmation-currently-off)
- [Email delivery: what was tried](#email-delivery-what-was-tried)
- [OAuth](#oauth)
- [The two route handlers](#the-two-route-handlers)
- [Password reset — built, not offered](#password-reset--built-not-offered)
- [Prerequisites](#prerequisites)
- [Verification](#verification)
- [Lessons that cost real time](#lessons-that-cost-real-time)
- [Still ahead](#still-ahead)

---

## Files

| File | Role |
|---|---|
| `proxy.ts` (repo root) | Refreshes the token on every request; optimistic redirects |
| `lib/supabase-server.ts` | `createServerClient` bound to `cookies()` — Server Components and Actions |
| `lib/supabase-browser.ts` | `createBrowserClient` — Client Components |
| `features/auth/types.ts` | `AuthUser`, `GuestProfile`, form state types |
| `features/auth/next-path.ts` | `safeNextPath()` and the OAuth `next` cookie |
| `features/auth/actions.ts` | Reads: `getAuthUser()`, `getGuestProfile()` |
| `features/auth/server-actions.ts` | Writes: `signIn`, `signUp`, `signOut`, `updateProfile`, `signInWithProvider`, `requestPasswordReset`, `updatePassword` |
| `features/auth/oauth-avatar.ts` | Copies a provider photo into the `guests` bucket, once |
| `features/auth/components/form-primitives.tsx` | `Field`, `FormBanner`, shared input styling |
| `features/auth/components/auth-form.tsx` | The `/login` form: both modes, plus GitHub and Google |
| `features/auth/components/forgot-password-form.tsx` | Requests a reset link |
| `features/auth/components/update-password-form.tsx` | Sets a new password |
| `app/(auth)/login/page.tsx` | `/login` |
| `app/(auth)/forgot-password/page.tsx` | `/forgot-password` |
| `app/(auth)/account/update-password/page.tsx` | `/account/update-password` |
| `app/auth/confirm/route.ts` | Verifies a mailed link — confirmation and recovery both |
| `app/auth/callback/route.ts` | Exchanges an OAuth code for a session |
| `ui/profile-icon.tsx` | The header's three-state account control |
| `ui/chrome-gate.tsx` | Hides header and footer on `/login` and `/forgot-password` |

The two route handlers live under `app/auth/`, **outside** the `(auth)` group, because a
`route.ts` cannot share a segment with a `page.tsx` and these have no UI to inherit.

**`actions.ts` holds reads, `server-actions.ts` holds writes.** The split is not cosmetic:
every export of a `"use server"` file is reachable as a public HTTP endpoint, and reads have
no business being one.

## The three clients

| Client | Session | Cached | Use for |
|---|---|---|---|
| `lib/supabase.ts` → `supabase` | none | per-function, via `use cache` | Public catalogue: stays, reviews |
| `lib/supabase-server.ts` → `createClient()` | caller's cookies | never | Server Components, Server Actions, Proxy |
| `lib/supabase-browser.ts` → `createClient()` | browser cookies | never | Client Components |

The server client is **not** a module singleton — `cookies()` differs per request, so a shared
instance would hand one visitor's session to the next.

## Session lifecycle

Supabase access tokens last about an hour. Refreshing one means **writing a cookie**, and in
the App Router only Server Actions, Route Handlers and Proxy may do that.

That is the entire reason `proxy.ts` exists:

1. It calls `getClaims()`, which refreshes an about-to-expire token as a side effect.
2. It writes the rotated cookie **twice** — to `request.cookies` so Server Components
   rendering *this* request see it, and to `response.cookies` for the next one.
3. It copies the no-store headers Supabase supplies alongside rotated cookies, so no CDN can
   cache a response carrying somebody's session token.

`lib/supabase-server.ts` swallows the write attempt in a `try/catch` for the same reason: a
Server Component cannot write cookies, and Proxy has already done the work.

> **Next 16 renamed `middleware.ts` to `proxy.ts`.** Same file, same behaviour, now on the
> Node.js runtime. Older notes in this repo saying "middleware.ts" mean this file.

## Why `getClaims()` and not `getSession()`

`getSession()` reads the cookie and trusts it. Supabase's guidance is blunt: *"Never trust
`supabase.auth.getSession()` inside server code."*

`getClaims()` verifies the JWT signature against the project's published keys. This project
uses **ES256**, so verification happens locally via WebCrypto with no network round-trip.

`getAuthUser()` wraps it in React's `cache()`, so the header, the page and any leaf component
asking the same question during one render share a single verification.

## Sign-up is a contract with a database trigger

`signUp` sends `display_name`, `full_name` and `nationality` in `options.data`. That lands in
`auth.users.raw_user_meta_data`, which `handle_new_guest()` (migration `0006`) reads to build
the `public.guests` row. Empty optional fields are omitted rather than sent as `""`.

Two things that are easy to get wrong:

1. **The trigger fires once.** It ends in `on conflict (id) do nothing`, so metadata edited
   later never flows through. `/account` writes to `public.guests` directly instead.
2. **It keys on `email_confirmed_at`, not on insert.** With confirmation off, Supabase stamps
   that column immediately and the guest row appears at once. Turn confirmation on and the row
   correctly waits for proof of the mailbox — no code change needed either way.

### `signUp()` succeeds in three different ways

Only one means "signed in", which is why `signUp` branches on the *result* rather than on
whether an error came back. Treating "no error" as success is what once made a failed
registration redirect as if it had worked.

| Result | Meaning | What the action does |
|---|---|---|
| `error` present | Mapped by `describeAuthError()` on `error.code` | Show the message |
| `data.user.identities` empty | Address already registered; Supabase obscured it | "This email is already registered" |
| `data.session` null | Account created, confirmation pending | Neutral notice, **no redirect** |
| session present | Genuinely signed in | `revalidatePath` then `redirect(next)` |

**Row four is the normal outcome today.** Rows two and three belong to the
confirmation-enabled world and are kept as insurance — that is one toggle away.

Errors are matched on `error.code`, never `error.message`: `ErrorCode` is a typed union in
`@supabase/auth-js`, while message text is free to change between releases.

## Rendering: why this needed Cache Components

The header shows who is signed in, and the header lives in the root layout. Reading the
session means reading cookies, and **without `cacheComponents` a `cookies()` call anywhere in
the tree makes the entire route dynamic** — Next.js granularity is per-route, not
per-component. That would have killed `generateStaticParams()` on `/stays/[stayId]`.

So `next.config.ts` sets `cacheComponents: true`. With it, `<Suspense>` becomes a real
boundary: the fallback ships in the static shell, only the session streams at request time.

The shape this forces:

- `ui/profile-icon.tsx` is an **async Server Component** wrapped in `<Suspense>` by
  `app/layout.tsx`. Its fallback is the signed-out icon — correct for most visitors.
- `ui/header.tsx` is a Client Component and therefore **cannot import** an async Server
  Component. It receives one as the `profileSlot` prop.
- Catalogue queries carry `use cache` + `cacheTag` + `cacheLife` instead of fetch-level options.

### ⚠️ Redirects must happen in Proxy, not only on the page

With a static shell, the shell is flushed **before** a page finishes rendering. A `redirect()`
reached after that cannot be an HTTP redirect — Next.js falls back to
`<meta http-equiv="refresh" content="1;…">`, a visible one-second stall.

So `proxy.ts` redirects signed-out visitors away from `/account`, and signed-in visitors away
from `/login`. Those are **optimistic** checks in the sense the Next.js auth guide uses — they
pre-filter, they do not authorize. `app/(auth)/account/page.tsx` still runs its own check,
because Proxy also runs on prefetches and must never be the only line of defence.

Adding a protected route means adding its prefix to `PROTECTED_PREFIXES` in `proxy.ts` **and**
checking the session on the page.

### `/login` renders without the site chrome

`ui/chrome-gate.tsx` hides header and footer on `/login` and `/forgot-password`, each of which
owns its whole viewport. `/account` and `/account/update-password` are deliberately not listed.

The gate is a Client Component because only the client knows the current path. Its children are
still server-rendered and passed as a prop, so wrapping `<Footer />` does not pull it into the
client bundle, and `usePathname()` runs during SSR so no hidden chrome reaches the HTML.

The alternative — a **separate root layout**, the documented Next.js approach — was rejected
for now: it requires every other route to move under a `(site)` group and turns navigation to
and from `/login` into a full page load. Revisit if more chrome-free routes appear.

## The `next` parameter

`/login?next=/stays` returns you where you started. The value is validated before use:

```ts
if (!path.startsWith("/") || path.startsWith("//")) return fallback;
```

Both halves matter. `//evil.example` is a protocol-relative URL and `https://evil.example` an
absolute one; both are plausible `next` values and both would redirect off-site. The rule is
"starts with exactly one slash".

`safeNextPath()` lives in [next-path.ts](next-path.ts) — its own module rather than an export
of `server-actions.ts`, because a `"use server"` file may only export async functions and every
export it has is a public endpoint. The route handlers import it too.

It is still duplicated in `proxy.ts` rather than imported. Deliberate: Proxy can be deployed
separately to a CDN, and the Next.js docs warn against relying on shared modules there. Two
copies, not four.

**OAuth is the one flow where `next` does not travel in the URL.** It rides in a short-lived
cookie, so exactly one callback URL ever needs to be in Supabase's allow-list — a URL that
varies per sign-in eventually fails to match.

Failed sign-in deliberately does not say which half was wrong. Distinguishing "no such account"
from "wrong password" turns the form into a way to test whether an address is registered here.

## Email confirmation: currently OFF

`mailer_autoconfirm: true` in `/auth/v1/settings`. **Note the inversion: `true` means
confirmation is OFF.**

Registration therefore completes immediately — Supabase stamps `email_confirmed_at`, the `0006`
trigger fires, and `signUp` redirects with a live session.

### Why it is off

Not a preference. Three mail providers were configured and none delivered:

| Provider | Outcome |
|---|---|
| **Supabase built-in** | 2 emails/hour, organisation members only, not raisable |
| **Brevo** | Never relayed a single message. New free accounts are held for validation with no published deadline |
| **Gmail SMTP** | Authenticated and relayed **successfully from a direct probe** (`235`, `250`) — and Supabase still returned `unexpected_failure` |
| **Resend** | Rejected before trying: needs a verified domain (below) |

Chasing the last gap stopped being worth its cost for a portfolio. Confirmation was switched
off so registration works; **GitHub and Google still prove verified-email auth**, because the
provider verifies the address before handing us the account.

Nothing was deleted to achieve this. `app/auth/confirm/route.ts`, both email templates and the
password-reset pages are all present and correct.

### Turning it back on

1. Dashboard → Authentication → Providers → Email → enable **Confirm email**.
2. Set both email templates (below) — the defaults do **not** work with this app.
3. In [auth-form.tsx](components/auth-form.tsx), flip `PASSWORD_RESET_AVAILABLE` to `true`.

No code changes beyond that constant. `signUp` already handles the confirmation-pending branch.

### Email templates — required if confirmation is ever enabled

**Authentication → Email Templates.** The defaults use `{{ .ConfirmationURL }}`, which resolves
to Supabase's `/auth/v1/verify` and then sends the guest to the **Site URL** — the homepage.
But `@supabase/ssr` runs `flowType: "pkce"`, so the link must return to a route that exchanges
the token. The homepage exchanges nothing, and the guest lands signed out.

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account">
  Confirm your email
</a>

<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/update-password">
  Reset password
</a>
```

`{{ .TokenHash }}`, **not** `{{ .ConfirmationURL }}`. `next` is hard-coded rather than
`{{ .RedirectTo }}`, which renders empty because `signUp` sends no `emailRedirectTo` — that is
what keeps absolute URLs out of the code entirely.

⚠️ A typo here fails as `unexpected_failure` — the same message as an SMTP outage — because
rendering happens before sending.

## Email delivery: what was tried

Kept so nobody repeats the search. **None of this is active**; SMTP settings can stay as they
are while confirmation is off.

| | Gmail | Brevo | Resend |
|---|---|---|---|
| Domain required | No | No | **Yes** |
| Sends to strangers without one | Yes | Yes, in theory | **No — 403** |
| Free quota | ~500/day | 300/day | 3,000/month |
| Host / port | `smtp.gmail.com:587` | `smtp-relay.brevo.com:587` | `smtp.resend.com:465` |
| Username | the Gmail address | `<id>@smtp-brevo.com` | `resend` |
| Password | 16-char App Password | SMTP key | API key |

**Resend needs a domain, and that is disqualifying here.** From its own knowledge base: with the
shared `resend.dev` domain *"you can only send testing emails to your own email address"* —
anything else returns **403**. Its Supabase-SMTP guide lists *"A verified domain"* as a
prerequisite. Free subdomains such as `*.vercel.app` cannot carry the DKIM/SPF records
verification needs. **The moment a domain exists, Resend is the right choice** — native Supabase
integration, better sending reputation, and a sender at your own domain.

With Gmail: **Sender email must equal Username.** Gmail only relays mail claiming to be from the
account that authenticated. It also requires 2-Step Verification before an App Password can be
generated, and it is that 16-character password that goes in the SMTP field.

### Diagnosing a send failure

The symptom is `unexpected_failure` / HTTP 500 / "Error sending confirmation email".

- **That code proves custom SMTP is enabled.** The built-in sender refuses non-members with
  `email_address_not_authorized` (422) instead. Do not re-check the toggle.
- **A failed send leaves nothing behind.** Supabase rolls the user back.
- **A malformed template gives the identical message** — suspect templates first if they were
  edited.

Test the mail host on its own, which separates "the host refuses" from "Supabase is
misconfigured":

```bash
SENDER='you@gmail.com'
read -s "SMTP_PASS?App Password: "; echo

printf 'From: The Seaspace <%s>\nTo: <%s>\nSubject: smtp probe\n\nprobe\n' \
  "$SENDER" "$SENDER" > /tmp/probe.txt

curl -v --url 'smtp://smtp.gmail.com:587' --ssl-reqd \
  --user "$SENDER:$SMTP_PASS" \
  --mail-from "$SENDER" --mail-rcpt "$SENDER" --upload-file /tmp/probe.txt 2>&1 \
  | sed -E 's/^> [A-Za-z0-9+/=]{20,}$/> [credential redacted]/'

rm /tmp/probe.txt
```

> 🔴 **The `sed` is not decoration.** `curl -v` prints the whole SMTP conversation, and
> `AUTH PLAIN` is **not encryption** — the line after it is base64 of `\0username\0password`,
> reversible by anyone in one command. Without the filter you put a working credential into
> your scrollback and into anything you paste it to. Every status code needed for diagnosis
> (`235`, `250`, `535`, `550`) starts with `<` and survives the filter.
>
> **If a probe output was ever shared anywhere, revoke that credential and issue a new one.**

Run it as one block — `/tmp/probe.txt` is created by the `printf` and removed at the end.

`235` then `250` means the host is healthy and the fault is in Supabase's settings; `535` means
wrong credentials; `550` usually means the sender does not match the authenticated account. If
the host is healthy, the raw SMTP reply is in **Dashboard → Logs → Auth Logs** — the `error_id`
from the failed response appears there. That log cannot be read from this repo: it needs a
Management API token, and `.env.local` holds only the URL, anon key, service role key and seed
password.

## OAuth

**Proven working end to end, on both providers.** Two accounts were created from the same
address at different times — one via Google, one via GitHub — and each produced an
`auth.users` row with `email_confirmed_at` set and **no email sent**, a `public.guests` row
from the trigger with the person's real name, and an avatar copied into the bucket
(`.png` from Google, `.jpg` from GitHub).

### Why OAuth needs no email

Google and GitHub have already verified the address. Supabase trusts that and sets
`email_confirmed_at` itself. The trigger's `coalesce` chain reads `display_name` → `full_name`
→ the email's local part; both providers supply `full_name`, so a real name lands in
`guests.display_name` with no schema change. Migration `0006` even anticipated a provider that
returns no email at all.

### Dashboard configuration

Both providers register the **same** callback, and it belongs to Supabase — **no domain of ours
is involved**:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

**GitHub** — *Settings → Developer settings → OAuth Apps.* No review, no user cap. "Expire user
access tokens" is irrelevant to the Supabase session: GitHub's token is used once, at the code
exchange, and never again.

**Google** — Google Cloud project with an External consent screen and a Web application client.
Two provider toggles in Supabase matter: *Allow users without an email* is **ON**, matching the
fallback already in `handle_new_guest()`; *Skip nonce checks* is **OFF**, since that is only for
native mobile ID-token sign-in and this app uses the standard web redirect flow.

> ⚠️ **Publishing status must be "In production", not "Testing."** In Testing, only 100
> manually-listed users can sign in and their tokens expire after 7 days — it looks fine to the
> project's owner and fails for everyone else. For `openid`, `email` and `profile`, publishing
> does **not** require Google's verification review.

### Provider avatars

Providers return `avatar_url` as a full external URL; `guests.avatar_path` stores a
bucket-relative path. [oauth-avatar.ts](oauth-avatar.ts) copies the bytes into the `guests`
bucket at first sign-in, so every avatar in the app has one origin and one code path.

Three properties to preserve when changing that file:

**Adoption, not sync.** It returns early once `avatar_path` is set, so a photo the guest
uploads later is never overwritten.

**It is an SSRF surface.** The URL is read from `identities[].identity_data`, never from
`user.user_metadata` — metadata is writable by the account holder through `updateUser({ data })`,
which would let anyone choose what address this server fetches. A host allow-list
(`.googleusercontent.com`, `.githubusercontent.com`, HTTPS only) is the second lock.

**No re-encoding, and no EXIF stripping.** The bucket already accepts `webp | jpeg | png | avif`
up to 512 KB, which keeps `sharp` out of the dependency list. That departs from the
manual-upload contract in [features/account/README.md](../account/README.md), and the reason is
specific: these bytes were re-encoded by the provider and the identical file is already public
at the provider's URL. **The manual upload path still must strip EXIF.**

It runs inside `after()` from `next/server`, so downloading a CDN image never sits between a
guest and their account. Every failure is swallowed — the worst outcome is the `UserCircleIcon`
placeholder.

## The two route handlers

Route Handlers, not pages — they may write cookies, which Server Components may not.

**[app/auth/confirm/route.ts](../../app/auth/confirm/route.ts)** — one route serves both
sign-up confirmation and password recovery; only `type` differs (`email` / `signup` versus
`recovery`), and it is passed to `verifyOtp` untouched so either template wording works.
Success redirects to `next` (default `/account`); every failure redirects to
`/login?error=link_invalid`. One message for all failures on purpose — expired, already used
and tampered-with are indistinguishable to the person holding the link, and saying which
applies tells an attacker whether a token was valid.

**[app/auth/callback/route.ts](../../app/auth/callback/route.ts)** — reads `code`, calls
`exchangeCodeForSession(code)`, redirects. `@supabase/ssr` defaults to `flowType: "pkce"`, so
the verifier travels in a cookie written when `signInWithProvider` started the flow.

`redirectTo` for OAuth is built from the request's own headers rather than an environment
variable, so it follows the deployment.

> ⚠️ **Where the allow-list actually applies.** Verified directly: `GET /auth/v1/authorize`
> passes an arbitrary `redirect_to` straight through to the provider without checking it. The
> Redirect URLs list is enforced on the way *back*; an unlisted destination falls back to the
> Site URL rather than receiving the code. The boundary is real, but not at the step you would
> probe first — do not read a 302 out of `/authorize` as proof a URL is allow-listed.

## Password reset — built, not offered

`requestPasswordReset` and `updatePassword` exist, along with `/forgot-password` and
`/account/update-password`. The link to them is hidden behind `PASSWORD_RESET_AVAILABLE` in
[auth-form.tsx](components/auth-form.tsx), because resetting a password requires delivering an
email. A link that answers "a reset link is on its way" while nothing arrives is worse than a
feature that is not advertised.

⚠️ **`requestPasswordReset` answers identically whether or not the address is registered** —
including on error. Otherwise it becomes a way to enumerate accounts, the same reasoning that
keeps `invalid_credentials` vague. Real failures reach the operator through `logAuthError`, not
the guest.

`updatePassword` does not distinguish a recovery session from a normal one. Both are legitimate,
and Supabase scopes the update to the session's own user either way.

## Prerequisites

| Setting | Where | Why |
|---|---|---|
| "Confirm email" **OFF** | Authentication → Providers → Email | No mail sender works, so confirmation would block every registration |
| GitHub and Google providers | Authentication → Providers | Client IDs and secrets live there, never in this repo |
| Site URL + Redirect URLs | Authentication → URL Configuration | `http://localhost:3000` and `http://localhost:3000/**`. **Both must change at deploy** — Site URL is *replaced*, and Google's Authorized JavaScript origins needs the new origin too |
| Asymmetric JWT signing keys | Authentication → Signing Keys | Lets `getClaims()` verify locally instead of round-tripping |

**Check them, never assume them.** One endpoint answers for three:

```bash
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL' .env.local | cut -d= -f2- | xargs)
KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY' .env.local | cut -d= -f2- | xargs)
curl -s "${URL%/}/auth/v1/settings" -H "apikey: $KEY" \
  | grep -o '"mailer_autoconfirm":[a-z]*\|"github":[a-z]*\|"google":[a-z]*'
# mailer_autoconfirm:true  = "Confirm email" is OFF — note the inversion
# github:true, google:true = both providers enabled
```

That last check earns its keep: a provider whose form looks filled in but was never saved reads
as `false` here, and nowhere else. It caught exactly that once already.

Environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, read at
module load in all three clients and in `proxy.ts`, which fails loudly rather than producing a
confusing 500 later.

## Verification

The 62 seeded accounts make **sign-in** testable without registering anything. Emails are
derived from the guest slug — `amara-lindqvist` → `amara.lindqvist@example.com` — and all share
`SEED_ACCOUNT_PASSWORD` from `.env.local`.

> ⚠️ **Those addresses work for signing in, never for signing up.** Supabase blocklists
> `example.com` outright (`email_address_invalid`) regardless of the confirmation setting.
> Testing registration needs a fresh address on a real domain.

**Registration** — through `/login`, with a real domain. Redirects straight in, no "check your
email" notice:

```sql
select count(*) from public.guests;   -- rises immediately, not after any link
select display_name, full_name, nationality
  from public.guests order by created_at desc limit 1;   -- matches the form
```

The header icon must become `UserCircleIcon` linking to `/account`. Then sign out and sign back
in with that account.

**Route guards**, with the dev server running:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/account
# 307 http://localhost:3000/login?next=%2Faccount

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
# 200

curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3000/auth/confirm?token_hash=nope&type=email"
# 307 http://localhost:3000/login?error=link_invalid
```

The last one proves the route rejects a bad token rather than erroring, and needs no email.

**RLS**, from a signed-in client: `supabase.from("guests").select("id")` returns exactly 1 row,
not 62. Anonymously it returns **0 rows and no error** — `public.guests` has no `anon` policy at
all, because it holds phone numbers.

**Passwords with spaces** — register with a password ending in a space, then sign in with
exactly that password.

**Build shape:**

```bash
npx tsc --noEmit && pnpm build
```

Every page stays `◐ Partial Prerender`; the two `/auth/*` entries appear as Route Handlers
(`ƒ`), which is expected.

## Lessons that cost real time

Kept because each one was learned the expensive way.

**Seed accounts cannot prove the confirmation setting.** All 62 were created with
`auth.admin.createUser({ email_confirm: true })`, which stamps `email_confirmed_at` directly —
sending no email and never reading the dashboard. They sign in perfectly while registration is
completely broken. The only valid check is `mailer_autoconfirm`.

**"No error" is not "signed in".** `signUp` returns an obfuscated fake user — `identities: []`,
`session: null`, **no error** — when the address already exists and both confirm settings are
on. Redirecting on that made a failed registration look like a completed one.

**Passwords must not be trimmed.** A shared `readString()` helper trimmed the password too, so
a trailing space was silently dropped at sign-up and silently failed to match at sign-in.
`readPassword()` reads it raw.

**Log the failures nobody can see.** There was no `console.error` anywhere in auth, so
diagnosing a failed send meant guessing. `logAuthError()` now records `code` and `status` —
**never the email address or password** — and stays quiet for ordinary user mistakes.

**Rejected: sign-up through `auth.admin.createUser()` with the service role key.** It works
without touching the dashboard — it is how the 62 seed accounts exist. But it puts service-role
privileges behind a public endpoint, and the service role **bypasses every RLS policy**: one
bug there reaches the whole database.

## Still ahead

- **Email delivery.** Everything above about confirmation and password reset waits on it.
- **Email change.** `auth.users.email` is not editable from `/account`; it needs its own
  confirmation step, and Supabase confirms to both the old and new address.
- **Review write path.** An RLS `insert` policy on `reviews` becomes expressible now that auth
  can prove who is writing.
- **Account deletion.** Specified in [ACCOUNT-DELETION-POLICY.md](../../ACCOUNT-DELETION-POLICY.md),
  not built — and now more urgent, because OAuth fills `avatar_path` automatically and deleting
  an account leaves the file in the bucket. See [features/account/README.md](../account/README.md).

## Sources

- [Supabase — Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase — Email-based auth with PKCE flow for SSR](https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr)
- [Supabase — Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud — When is verification not needed](https://support.google.com/cloud/answer/13464323)
- [Google — Sign in with App Passwords](https://support.google.com/accounts/answer/185833)
- [Resend — 403 error using the resend.dev domain](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
- [Next.js — `after`](https://nextjs.org/docs/app/api-reference/functions/after)
