/** Public base URL: APP_URL, else the host's own production address (Netlify or Vercel), else localhost. */
export function appUrl(): string {
  const netlify = process.env.URL?.startsWith("https://") ? process.env.URL : ""; // Netlify's main site address
  const v =
    process.env.APP_URL ||
    netlify ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return v.replace(/\/$/, "");
}
