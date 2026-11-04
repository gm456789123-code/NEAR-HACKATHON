import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getDatasourceUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && !envUrl.startsWith("file:.")) {
    return envUrl;
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
