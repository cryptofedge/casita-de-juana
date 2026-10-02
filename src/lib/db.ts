import { PrismaClient } from "@prisma/client";

// File bytes live in FileAsset.data. They are omitted from every query by default so list pages
// never drag megabytes around; the file route opts in with `omit: { data: false }`.
const make = () => new PrismaClient({ omit: { fileAsset: { data: true } } });

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof make> };

export const db = globalForPrisma.prisma ?? make();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
