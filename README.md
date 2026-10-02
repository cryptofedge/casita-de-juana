# Casita de Juana — Property Office & Tenant Portal

Back-office for the owner and a mobile-first portal for tenants of **Casita de Juana**
(Ortega, Dominican Republic): Apt 1 (floor 1) and Apt 2A / 2B (floor 2), with support for adding more units.

**Stack:** Next.js 16 (App Router) · TypeScript · PostgreSQL + Prisma 6 · Auth.js v5 (credentials, RBAC) ·
Tailwind CSS v4 + shadcn-style components · React Hook Form + Zod.

---

## Quick start

Requirements: **Node 20+** and **PostgreSQL 14+** (Docker *or* the bundled no-Docker helper).

```bash
# 1. Install (also runs `prisma generate`)
npm install

# 2. Configure
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
#    then set AUTH_SECRET:   npx auth secret      (or: openssl rand -base64 32)

# 3. Start PostgreSQL — pick ONE
docker compose up -d          # option A: Docker
npm run db:local              # option B: no Docker (embedded Postgres, keep this terminal open)

# 4. Create the tables and load demo data
npm run db:push
npm run db:seed

# 5. Run
npm run dev                   # http://localhost:3000
```

### Demo accounts (created by `npm run db:seed`)

| Role | Email | Password |
|---|---|---|
| Owner | `owner@casitadejuana.test` | `SEED_OWNER_PASSWORD` in `.env` (default `Owner#2026`) |
| Tenant, Apt 1 | `carlos.pena@example.com` | `SEED_TENANT_PASSWORD` (default `Tenant#2026`) |
| Tenant, Apt 2A | `maria.santos@example.com` | same (her lease is in **DOP**) |
| Tenant, Apt 2B | `james.wilson@example.com` | same (one month behind → **Overdue** + late fee) |

> `db:seed` **wipes all tables first** — use it for development/demo only. Change the passwords or
> delete the demo users before going live.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve build |
| `npm run db:push` | Sync `prisma/schema.prisma` to the database (quick start) |
| `npm run db:migrate` | Create versioned migrations (recommended once you go to production) |
| `npm run db:seed` | Reset + load demo data |
| `npm run db:studio` | Browse the data in Prisma Studio |
| `npm test` | Unit tests for the ledger / status engine |
| `npm run lint` | ESLint |

---

## What's inside

### Owner back-office (`/admin`)
- **Dashboard** – collected this month, outstanding (and overdue) balance, active maintenance (urgent count),
  occupancy, per-unit status, 6-month collection chart.
- **Rent & Payments** – monthly statement per unit (opening / billed / paid / closing), record payments
  (cash, bank transfer, PayPal, Stripe) with **receipt photo/PDF**, one-off charges, payment history,
  **CSV export** and a **printable statement** (Print → *Save as PDF*).
- **Electricity** – sub-meter readings per unit (previous, current, rate/kWh → subtotal, due date) with
  **meter photo**. Saving a reading **automatically adds the bill to the tenant's balance**.
- **Maintenance & ideas** – all tickets, filter by status, urgent first; threaded conversation with the tenant,
  photo attachments, status `Open → In progress → Resolved → Closed`.
- **Tenants & Units** – add units any time (e.g. `3A`), add a tenant to a vacant unit (creates login + lease and
  a one-time **invite link**), edit lease terms, regenerate sign-in/reset links, end a lease (revokes access).
- **Notice board**, **Document vault** (leases, house rules, IDs — per tenant or shared), **Emergency contacts**,
  **Settings** (USD↔DOP rate, property info).

### Tenant portal (`/portal`) — mobile first
Bottom-tab navigation: **Home** (balance, next due, pinned notices, quick actions) · **Rent** (charges with
`Paid / Pending / Partial / Overdue` badges, payment history, receipts) · **Power** (bills, kWh, meter photos) ·
**Requests** (submit with photos, chat with the owner) · **More** (notices, documents, tap-to-call emergency contacts).

### Languages (English / Español)
The **tenant portal, login and invitation pages are fully translated** (ES / EN toggle in the header). The language is
remembered in a cookie; first visit follows the browser (`Accept-Language`). The owner back-office stays in English.
- Dictionary: `src/lib/i18n/es.ts` — English text is the key; anything missing falls back to English.
- Server pages: `const { t, locale } = await getI18n()`; client components: `useT()`.
- Add a language: add a dictionary, extend `Locale` in `src/lib/i18n/index.ts`, and add it to `LanguageToggle`.
- Content typed by the owner (notices, contact names, ticket text) is shown as written; charge names ("Rent - October 2026")
  are rebuilt in the tenant's language from type + period.

### Money & billing rules
- Amounts are stored in **minor units** (cents) in each lease's currency (USD or DOP). The header toggle shows
  everything in USD or DOP using the exchange rate from *Settings*.
- **Rent** is generated automatically each month from the lease start (`dueDay`, default 1st).
- Payments are applied **oldest charge first**. Status per charge: `Paid` (nothing left) · `Overdue` (unpaid after
  due date + grace days) · `Partial` (part paid, not late yet) · `Pending`.
- **Late fees** (flat and/or %) are added once per overdue rent charge after the grace period. The owner can waive them.
- Billing runs lazily on page loads and via `GET /api/cron/billing` (header `Authorization: Bearer $CRON_SECRET`) —
  schedule it daily (Vercel Cron, GitHub Actions, or crontab + curl).

---

## Security model

- **RBAC**: `/admin/*` is owner-only, `/portal/*` is tenant-only (proxy gate **plus** server-side checks in every
  layout, page, server action and API route). The DB user is re-checked on each request, so deactivated accounts lose
  access immediately.
- **Tenant scoping**: every tenant query derives the lease/unit/user from the *session*, never from URL or form
  values. Another tenant's ticket URL → 404.
- **Files** are never public. They live in `UPLOAD_DIR` and are served only through `/api/files/[id]`, which checks
  that the signed-in user may see that exact file (`Cache-Control: no-store`). Uploads are limited to JPG/PNG/WebP/HEIC/PDF,
  4 MB, with **magic-byte sniffing** (a renamed `.exe`/HTML is rejected).
- Passwords: bcrypt (cost 12), ≥ 8 chars; login has a per-email brute-force limiter (in-memory — add a shared limiter if
  you run several instances). Invite links are random 192-bit tokens, single-use, expire in 7 days.
- CSV export neutralises spreadsheet formula injection.

## Project layout

```
prisma/            schema.prisma, seed.ts
scripts/dev-db.mjs embedded Postgres for machines without Docker
src/
  auth.ts, auth.config.ts, proxy.ts      Auth.js + route gating
  actions/                               server actions (auth, tenants, finance, utilities, maintenance, content)
  lib/                                   ledger.ts (status engine), billing.ts, statement.ts, money.ts, storage.ts, validators.ts …
  components/                            ui/ (shadcn-style), forms/, admin/, shared/
  app/
    (auth)/login, invite/[token]
    admin/…            owner back-office
    portal/…           tenant portal
    api/               files/[id], admin/statement (CSV), cron/billing, auth
public/brand/          logo + app icons
```

## Deploy for free (Vercel + Neon)

The repo is ready for Vercel: `vercel.json` runs `scripts/vercel-build.mjs`, which creates/updates the tables,
creates your owner login, and builds. Uploads are stored in the database, so no disk or S3 is needed.

1. **Neon database** (free): at https://neon.tech sign up with GitHub and create a project (region closest to you).
2. **Vercel** (free Hobby plan): at https://vercel.com sign up with GitHub → *Add New… → Project* → import `casita-de-juana`.
3. In the import screen add **Environment Variables**:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string (the *pooled* one) |
   | `DATABASE_URL_UNPOOLED` | Neon *direct* (non-pooled) connection string |
   | `AUTH_SECRET` | any long random string (`npx auth secret`) |
   | `CRON_SECRET` | another long random string |
   | `BOOTSTRAP_OWNER_EMAIL` | your email |
   | `BOOTSTRAP_OWNER_PASSWORD` | a strong password (10+ chars) |
   | `BOOTSTRAP_OWNER_NAME` | your name |
   (Tip: *Storage → Create → Neon* inside Vercel sets the two `DATABASE_URL*` variables for you.)
4. **Deploy.** Open the `*.vercel.app` link and sign in with the owner email/password. Then delete
   `BOOTSTRAP_OWNER_PASSWORD` from the Vercel settings.
5. Optional: add a custom domain in Vercel → Settings → Domains (invite links and WhatsApp previews use the production domain
   automatically; set `APP_URL` only if you use a custom domain that Vercel doesn't list as production).

The daily billing job (rent + late fees) is scheduled in `vercel.json` and authenticates with `CRON_SECRET`.
Free-tier notes: Neon's free database is 0.5 GB (plenty for 3 units; photos are shrunk to ~300 KB on the phone) and
sleeps when idle, so the first request after a quiet period can take a second or two longer.
Demo data is **not** loaded on deploy; tenants are added from the Tenants page.

## Other hosting
Any Node host + Postgres works (`npm run build && npm start`); run `npx prisma db push` once and create the owner with
`BOOTSTRAP_OWNER_*` + `node scripts/bootstrap-owner.mjs`. Use `npx prisma migrate` instead of `db push` if you prefer versioned migrations.

## Known limitations / ideas for next steps

- Invite links are copied and sent by the owner (WhatsApp/SMS/email); there is no built-in email/SMS delivery yet.
- Payments are *logged by the owner*; no online card checkout (PayPal/Stripe are recorded as methods, not integrated).
- The UI is English only; Spanish translation (`next-intl`) would be a natural addition for tenants.
- A tenant whose lease ended keeps their email reserved; re-letting to the same person means reactivating them in the DB.
