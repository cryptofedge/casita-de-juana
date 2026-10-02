import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

// Small in-memory brute-force guard: 8 failures / 15 min per email.
// (Per-instance only; put Redis or your host's rate limiter in front for multi-instance setups.)
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 8;

function blocked(email: string) {
  const a = attempts.get(email);
  if (!a) return false;
  if (Date.now() - a.first > WINDOW) {
    attempts.delete(email);
    return false;
  }
  return a.count >= MAX_FAILS;
}

function recordFail(email: string) {
  const a = attempts.get(email);
  if (!a || Date.now() - a.first > WINDOW) attempts.set(email, { count: 1, first: Date.now() });
  else a.count += 1;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        if (blocked(email)) return null;

        const user = await db.user.findUnique({ where: { email } });
        // Compare even when the user is missing to keep timing uniform.
        const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
        const ok = await bcrypt.compare(password, hash);
        if (!user || !user.active || !user.passwordHash || !ok) {
          recordFail(email);
          return null;
        }
        attempts.delete(email);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});
