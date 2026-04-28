# Door Access Quote Builder

A small static web app for building door access quotes from reusable equipment templates.

## Features

- Seeded catalog for Axis cameras, Honeywell access panels/readers, ASSA ABLOY 9600 strikes, door hardware, cards, labor, and commissioning
- Editable quote lines with quantity, unit price, notes, margin, tax, and terms
- Browser-saved quote templates
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

## License

MIT
