/** Public base URL: APP_URL, else Vercel's production domain, else localhost. */
export function appUrl(): string {
  const v =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return v.replace(/\/$/, "");
}
