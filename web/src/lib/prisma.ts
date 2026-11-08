import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getDatasourceUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && !envUrl.startsWith("file:.")) {
    return envUrl;
  }
  // On Vercel serverless runtime, filesystem outside /tmp is read-only
  if (process.env.VERCEL === "1") {
    return "file:/tmp/dev.db";
  }
  const cwd = process.cwd();
  const dbPath = cwd.endsWith("web")
    ? path.join(cwd, "prisma", "dev.db")
    : path.join(cwd, "web", "prisma", "dev.db");
  return `file:${dbPath.replace(/\\/g, "/")}`;
}

const datasourceUrl = getDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
