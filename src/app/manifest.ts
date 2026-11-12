import type { MetadataRoute } from "next";

/**
 * Makes Casita installable as an app on Android, iPhone/iPad and desktop ("Install app" / "Add to Home Screen").
 * It opens at "/", which sends tenants to their portal and the owner to the back-office (or to sign-in).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Casita de Juana",
    short_name: "Casita",
    description: "Tenant portal and property office for Casita de Juana · Portal de inquilinos",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#fbf7ee",
    theme_color: "#19778a",
    lang: "es",
    dir: "ltr",
    categories: ["lifestyle", "productivity", "finance"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon (Android) for these.
    shortcuts: [
      { name: "Rent & payments · Alquiler y pagos", short_name: "Rent", url: "/portal/payments", icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Report a problem · Reportar un problema", short_name: "Report", url: "/portal/requests/new", icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
