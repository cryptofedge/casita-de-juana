// Vercel build: create/upgrade tables, create the first owner login, then build the app.
//   node scripts/vercel-build.mjs
// Schema changes use `prisma db push` WITHOUT --accept-data-loss, so a destructive change fails the
// build instead of silently deleting data. Use the direct (non-pooled) connection for DDL when available.
import { spawnSync } from "node:child_process";

const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
const ddlEnv = direct ? { DATABASE_URL: direct } : {};

function run(cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true, env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add a Postgres database (Neon) to the Vercel project first.");
  process.exit(1);
}
if (!process.env.AUTH_SECRET) {
  console.error("AUTH_SECRET is not set. Add it in Vercel > Settings > Environment Variables.");
  process.exit(1);
}

run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "db", "push", "--skip-generate"], ddlEnv);
run("node", ["scripts/bootstrap-owner.mjs"], ddlEnv);
run("npx", ["next", "build"]);
