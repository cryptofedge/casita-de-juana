import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Casita de Juana",
    short_name: "Casita",
    description: "Tenant portal for Casita de Juana",
    start_url: "/portal",
    display: "standalone",
    background_color: "#fbf7ee",
    theme_color: "#19778a",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
