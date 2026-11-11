/** Public base URL: APP_URL, else the host's own public URL (Render or Vercel production), else localhost. */
export function appUrl(): string {
  const v =
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return v.replace(/\/$/, "");
}
