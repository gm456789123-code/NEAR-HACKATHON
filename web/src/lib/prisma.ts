import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Defaults to a local SQLite file so the app runs with zero .env setup.
const datasourceUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
