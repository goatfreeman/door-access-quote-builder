# Quick Quote Builder

Next.js, React, TypeScript, Tailwind CSS, and shadcn/ui app for building quick equipment, labor, and template-based quotes.

## Features

- Quote flow for picking items, customizing cart lines, reviewing, and finalizing
- Admin console at `/admin` for admin users to oversee QQB and future managed apps
- Editable item catalog with unit price, ADI MSRP, vendor, category, and inventory fields
- Item catalog, templates, quotes, drafts, sessions, settings, and debug logs are read from the configured database
- Template database starts empty, so templates can be built from the live item catalog
- Expandable quote rows that show item name and quantity first, with price and notes inside the dropdown
- Saved previous quote summaries with original quote date and edit/remove actions
- Settings page with account, database, admin-only plugin status, sync button, and last sync time
- Mobile-friendly slide-out navigation and bottom total bar
- Print/save-as-PDF workflow and customer email prompt
- Controlled item-compatibility workspace at `/validation`
- Independent Codex researcher, verifier, and tester stages with structured evidence
- Deterministic `RULE-014` arithmetic checks for normalized quote-line data

## Run Locally

```powershell
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Deploy on Vercel

Import the GitHub repository into Vercel. Vercel will auto-detect Next.js and run the standard build.

### Supabase Migration Target

The target production stack is:

```text
Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
Backend: Next.js Server Actions and API routes
Database: Supabase PostgreSQL
Auth: Supabase Auth
Security: Supabase Row Level Security
Hosting: Vercel
```

Add these Supabase variables in Vercel when the Supabase project is ready:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.vercel.app
```

Run [docs/supabase-schema.sql](docs/supabase-schema.sql) in Supabase SQL Editor to create the QQB tables, indexes, triggers, and RLS policies. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only and never expose it to browser code.

Supabase Auth is the login path. Password login, magic-link login, and Azure SSO all go through Supabase.

Supabase PostgreSQL is also the primary app database when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present. Items, templates, quotes, drafts, sessions, and debug logs are stored in their matching Supabase tables. Settings are stored in `public.app_settings` under the `settings` key.

ServiceTitan and ADI credentials are plugin configuration and must be set as server-only Vercel environment variables:

```text
SERVICE_TITAN_BASE_URL=
SERVICE_TITAN_TENANT_ID=
SERVICE_TITAN_CLIENT_ID=
SERVICE_TITAN_CLIENT_SECRET=
ADI_BASE_URL=
ADI_ACCOUNT_NUMBER=
ADI_API_KEY=
```

In Supabase Auth, add the deployed site URL and callback URL:

```text
Site URL: https://your-vercel-domain.vercel.app
Redirect URL: https://your-vercel-domain.vercel.app/auth/callback
Redirect URL: https://your-vercel-domain.vercel.app
Local Redirect URL: http://localhost:3000/auth/callback
Local Redirect URL: http://localhost:3000
```

For temporary Supabase password testing, create users in Supabase Auth that match the demo emails:

```text
qqb.admin@example.com
qqb.tech@example.com
```

Set the admin user's `profiles.role` to `admin` after that profile is created.

For Microsoft Entra ID SSO routing, configure Azure as a Supabase Auth provider and add:

```text
AZURE_SSO_EMAILS=user@example.com
AZURE_SSO_DOMAINS=example.com
```

The UI shows a `Dev Build` badge unless `NEXT_PUBLIC_APP_STAGE` is set to `production`.

## Caltron Item Validation

The `/validation` workspace accepts product identifiers and a compatibility question. It preserves the source part number and creates a separate normalized lookup key. It then runs three distinct stages:

1. Researcher: finds current manufacturer evidence.
2. Verifier: checks the evidence and claim independently.
3. Tester: challenges the conclusion and defines measurable tests.

Every result uses `CONFIRMED`, `ASSUMED`, `OPEN`, `CONFLICT`, `BLOCKED`, or `NOT APPLICABLE`. Every result remains a draft for a qualified Caltron reviewer.

The current adapter uses a separately authorized Codex CLI session on the application server. The application does not inspect or retain Codex credential files. Enable the adapter only on a controlled local or self-hosted server:

```text
CODEX_VALIDATION_ENABLED=true
CODEX_VALIDATION_ISOLATED=true
```

This adapter is not available on a standard Vercel deployment because Vercel does not provide the authorized local CLI session. All modes require `CODEX_VALIDATION_ISOLATED=true`. Set that value only when a separate operating-system account or container restricts the worker's filesystem and credential access. The setting does not create the isolation boundary. Do not send client names, project locations, device locations, network details, credentials, prices, or controlled drawings to the validation workflow.

See [docs/caltron-validation-requirements.md](docs/caltron-validation-requirements.md) for the requirement traceability matrix, implemented controls, open inputs, and phased work.

## Change and Deployment Workflow

Create a feature branch for every change. Run `npm test` and `npm run build`. Push the branch with GitHub Desktop. Create a pull request before merge or deployment. Do not merge a failed or unreviewed pull request. Repository branch protection remains an administrator decision.

## Future Database and Integrations

Current editable data is stored through the app API routes backed by Supabase PostgreSQL:

```text
/api/db/items
/api/db/templates
/api/db/quotes
/api/db/settings
```

REST-style API routes are also available for future web, iOS, and Android clients:

```text
GET    /api/v1/items
POST   /api/v1/items
GET    /api/v1/items/:id
PATCH  /api/v1/items/:id
DELETE /api/v1/items/:id

GET    /api/v1/templates
POST   /api/v1/templates
GET    /api/v1/templates/:id
PATCH  /api/v1/templates/:id
DELETE /api/v1/templates/:id

GET    /api/v1/quotes
POST   /api/v1/quotes
GET    /api/v1/quotes/:id
PATCH  /api/v1/quotes/:id
DELETE /api/v1/quotes/:id
GET    /api/v1/quotes/:id/revisions

GET    /api/v1/drafts
POST   /api/v1/drafts
GET    /api/v1/drafts/:id
PATCH  /api/v1/drafts/:id
DELETE /api/v1/drafts/:id

GET    /api/v1/sessions
POST   /api/v1/sessions
GET    /api/v1/sessions/:id
PATCH  /api/v1/sessions/:id
DELETE /api/v1/sessions/:id
```

These endpoints use the same login session as the web app. Items and quotes are soft-deleted; templates, drafts, and sessions are removed from their collections.

Supabase PostgreSQL is the source of truth when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured. The app no longer seeds items from a bundled CSV file or reads stale browser caches as database fallbacks.

Templates should store item IDs in their line records. When an item is deleted, the backend should cascade that item ID out of every template line before saving.

ServiceTitan and ADI MSRP are represented as server-side plugins under `src/lib/plugins`. The browser can see connection status for admin users, but API keys stay in Vercel environment variables.

## License

MIT
