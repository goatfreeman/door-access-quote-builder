# Quick Quote Builder

Next.js, React, TypeScript, and Tailwind CSS app for building quick equipment, labor, and template-based quotes.

## Features

- Quote flow for picking items, customizing cart lines, reviewing, and finalizing
- Editable item catalog with unit price, ADI MSRP, vendor, category, and inventory fields
- Item catalog lives in `public/data/item-database.csv` so UI rewrites can leave item data alone
- Template database starts empty, so templates can be built from the live item database
- Expandable quote rows that show item name and quantity first, with price and notes inside the dropdown
- Saved previous quote summaries with original quote date and edit/remove actions
- Settings page with account placeholder, database placeholder, ServiceTitan admin fields, sync button, and last sync time
- Mobile-friendly slide-out navigation and bottom total bar
- Print/save-as-PDF workflow and customer email prompt

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

## Future Database and Integrations

Current editable data persists in browser storage while the app is being shaped. The item catalog starts from `public/data/item-database.csv`, but after first load, browser storage is the local database. Deleting an item also removes that item from templates and the active quote.

For production, use a NoSQL backend so item, template, and quote edits are shared across users/devices. A good structure is:

- `items`
- `templates`
- `quotes`
- `settings`

Templates should store item IDs in their line records. When an item is deleted, the backend should cascade that item ID out of every template line before saving.

ServiceTitan and ADI MSRP fields are already represented in the UI so API-backed sync can be wired in later without redesigning the quoting workflow.

## License

MIT
