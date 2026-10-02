// Creates the first owner login from environment variables - only if that email does not exist yet.
//   BOOTSTRAP_OWNER_EMAIL, BOOTSTRAP_OWNER_PASSWORD (min 10 chars), BOOTSTRAP_OWNER_NAME (optional)
// Safe to run on every deploy. After the first successful deploy you can delete the password variable.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const email = process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_OWNER_PASSWORD;

if (!email || !password) {
  console.log("bootstrap-owner: BOOTSTRAP_OWNER_EMAIL / BOOTSTRAP_OWNER_PASSWORD not set - skipping.");
  process.exit(0);
}
if (password.length < 10) {
  console.error("bootstrap-owner: BOOTSTRAP_OWNER_PASSWORD must be at least 10 characters.");
  process.exit(1);
}

const db = new PrismaClient();
try {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`bootstrap-owner: ${email} already exists - nothing to do.`);
  } else {
    await db.user.create({
      data: {
        email,
        name: process.env.BOOTSTRAP_OWNER_NAME || "Owner",
        role: "OWNER",
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    console.log(`bootstrap-owner: created owner ${email}.`);
  }
} finally {
  await db.$disconnect();
}
