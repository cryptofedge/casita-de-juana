// Starts a local PostgreSQL (no Docker needed) using the embedded-postgres dev dependency.
// Data lives in ./.pgdata. Credentials match .env.example:
//   postgresql://postgres:postgres@localhost:5432/casita?schema=public
// Stop with Ctrl+C. For production use a managed Postgres (Neon, Supabase, RDS...).
import fs from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const dir = "./.pgdata";
const fresh = !fs.existsSync(dir);

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
});

if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("casita");

console.log("PostgreSQL ready on localhost:5432 (db: casita). Press Ctrl+C to stop.");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
