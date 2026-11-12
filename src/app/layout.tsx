import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { appUrl } from "@/lib/app-url";
import { installBootScript } from "@/lib/pwa";

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
  // iPhone/iPad home-screen app: short label (iOS cuts long ones), normal status bar above the app.
  appleWebApp: { capable: true, title: "Casita", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#19778a",
  width: "device-width",
  initialScale: 1,
  // Use the whole screen on phones with a notch / home bar; safe-area padding keeps content clear of them.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <head>
        {/* Installed-app support: runs while the page is still loading (see src/lib/pwa.ts). Static text, no user data. */}
        <script id="install-app" dangerouslySetInnerHTML={{ __html: installBootScript(process.env.NODE_ENV === "production") }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
