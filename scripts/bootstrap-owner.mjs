// Creates the first owner login on deploy - only if NO owner exists yet.
//   BOOTSTRAP_OWNER_PASSWORD   (min 10 chars; required to create anything)
//   BOOTSTRAP_OWNER_EMAIL      (optional)  real email, or leave unset for a PLACEHOLDER owner
//   BOOTSTRAP_OWNER_NAME       (optional)
//
// Placeholder owner: with no email, the account is created as owner@casita-setup.invalid (name from
// BOOTSTRAP_OWNER_NAME). You can sign in with it right away, and the real owner replaces it on /setup
// using SETUP_CODE. Safe to run on every deploy; delete the password variable once you are done.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const PLACEHOLDER = "owner@casita-setup.invalid";
const email = (process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase()) || PLACEHOLDER;
const password = process.env.BOOTSTRAP_OWNER_PASSWORD;

if (!password) {
  console.log("bootstrap-owner: BOOTSTRAP_OWNER_PASSWORD not set - skipping (use /setup to create the owner).");
  process.exit(0);
}
if (password.length < 10) {
  console.error("bootstrap-owner: BOOTSTRAP_OWNER_PASSWORD must be at least 10 characters.");
  process.exit(1);
}

const db = new PrismaClient();
try {
  const owners = await db.user.count({ where: { role: "OWNER" } });
  if (owners > 0) {
    console.log("bootstrap-owner: an owner already exists - nothing to do.");
  } else {
    await db.user.create({
      data: {
        email,
        name: process.env.BOOTSTRAP_OWNER_NAME || "Owner",
        role: "OWNER",
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    console.log(`bootstrap-owner: created owner ${email}${email === PLACEHOLDER ? " (placeholder, claim it at /setup)" : ""}.`);
  }
} finally {
  await db.$disconnect();
}
