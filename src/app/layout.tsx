import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { appUrl } from "@/lib/app-url";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  // Absolute base so share previews (WhatsApp, iMessage, Facebook) get full image URLs.
  metadataBase: new URL(appUrl()),
  openGraph: {
    type: "website",
    siteName: "Casita de Juana",
    title: "Casita de Juana",
    description: "Portal de inquilinos · Tenant portal — Ortega, Dominican Republic",
    locale: "es_DO",
    alternateLocale: ["en_US"],
  },
  twitter: { card: "summary_large_image", title: "Casita de Juana" },
  title: { default: "Casita de Juana", template: "%s · Casita de Juana" },
  description: "Property management and tenant portal for Casita de Juana, Ortega, Dominican Republic.",
  applicationName: "Casita de Juana",
  appleWebApp: { capable: true, title: "Casita de Juana", statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#19778a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
