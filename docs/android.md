# Android App Wrapper

Quick Quote Builder remains a Next.js app deployed on Vercel. The Android build uses Capacitor as a native shell that loads the deployed Vercel app, so Supabase Auth, API routes, PDF generation, and server-side plugin checks continue to run on the hosted backend.

## Prerequisites

- Node.js and npm
- Android Studio
- Android SDK and JDK configured for Android Studio
- A deployed Vercel URL for this app

## First Setup

```powershell
npm install
$env:CAPACITOR_SERVER_URL="https://your-vercel-domain.vercel.app"
npm run android:add
npm run android:sync
npm run android:open
```

Android Studio will open the generated native project. Build and run from Android Studio for emulator or physical device testing.

## Local Emulator Testing

For an Android emulator pointing at a local Next dev server, use:

```powershell
$env:CAPACITOR_SERVER_URL="http://10.0.2.2:3000"
npm run android:sync
npm run android:open
```

`10.0.2.2` is the Android emulator route back to the host machine.

## Production Build Notes

- Set `CAPACITOR_SERVER_URL` to the production Vercel URL before syncing.
- Add native app icons and splash assets before Play Store release.
- Keep Supabase and integration keys in Vercel environment variables. The Android app should only receive public client settings through the hosted web app.
