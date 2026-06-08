import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://door-access-quote-builder.vercel.app";

const config: CapacitorConfig = {
  appId: "com.quickquotebuilder.app",
  appName: "Quick Quote Builder",
  webDir: "native/capacitor-shell",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  android: {
    backgroundColor: "#f5f5f4",
  },
};

export default config;
