# Quick Quote Builder

A small static web app for building quick quotes from reusable item and labor templates.

## Features

- Seeded catalog for Axis cameras, Honeywell access panels/readers, ASSA ABLOY 9600 strikes, door hardware, cards, labor, and commissioning
- Editable quote lines with quantity, unit price, notes, margin, tax, and terms
- Browser-saved quote templates with Vercel API routes for database-backed storage
- Item overrides for price and inventory to avoid ServiceTitan/catalog discrepancies
- Future-ready ServiceTitan sync endpoint for items, price, and inventory
- Dedicated Items view for full catalog editing
- Mobile slide-out navigation for Quotes, Items, and Previous Quotes
- Settings admin panel for temporary ServiceTitan configuration during setup
- Quote total labor checkbox with editable hours and rate
- Previous quote history with quoted date, total, view/edit, and delete actions
- PDF-ready quote generation through the browser print/save-as-PDF workflow with a customer email prompt
- MSRP field for ADI or other supplier list pricing alongside editable sell price
- Copyable quote summary
- Print-friendly quote preview

## Run Locally

```powershell
node server.js
```

Then open:

```text
http://localhost:3000
```

## Deploy on Vercel

This is a static app. Import the GitHub repository into Vercel and keep the default static settings. The included `vercel.json` disables a build step and serves the project root.

## Database Setup

The app includes `/api/items`, `/api/templates`, and `/api/quotes`. By default these routes use in-memory storage on the server and browser storage in the client. For persistent shared storage, set these Vercel environment variables:

```text
DATA_API_URL=https://your-database-rest-api.example.com
DATA_API_TOKEN=your-server-token
```

The database API should expose:

```text
GET  /items
POST /items
GET  /templates
POST /templates
GET  /quotes
POST /quotes
DELETE /quotes/:id
POST /items/bulk
```

This keeps the app database-agnostic so it can point at Supabase, Neon-backed API routes, Airtable, or an internal inventory service later.

## ServiceTitan Setup

The sync endpoint is `/api/sync-servicetitan`. Add these Vercel environment variables when you have ServiceTitan API credentials:

```text
SERVICETITAN_BASE_URL=https://api.servicetitan.io
SERVICETITAN_CLIENT_ID=...
SERVICETITAN_CLIENT_SECRET=...
SERVICETITAN_TENANT_ID=...
```

Synced items keep their ServiceTitan source ID, then you can edit local price/inventory overrides in the Items view to resolve discrepancies before quoting. During setup, the Settings panel can store ServiceTitan values locally in the browser; in production, prefer Vercel environment variables and expose only Sync plus last sync time.

## ADI MSRP

The Items view includes an MSRP field so ADI list pricing can be stored separately from the quote sell price. When ADI API, CSV export, or another supplier feed is available, map the ADI item number to `sourceId`, set `source` to `ADI`, and store the supplier list price in `msrp`.

## License

MIT
