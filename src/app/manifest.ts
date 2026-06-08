import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quick Quote Builder",
    short_name: "QQB",
    description: "Build equipment, labor, template, and service quotes quickly.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#0f766e",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/qqb-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}
