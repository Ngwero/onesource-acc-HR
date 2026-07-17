import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createPgPool } from "./pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion: string | undefined;
};

// Bump when enum/schema changes require a fresh client in dev (avoids stale singleton)
const PRISMA_CLIENT_VERSION = "20260717094500-hr-comprehensive";

function createPrismaClient() {
  const pool = createPgPool();
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  if (
    process.env.NODE_ENV !== "production" &&
    globalForPrisma.prisma &&
    globalForPrisma.prismaVersion === PRISMA_CLIENT_VERSION
  ) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaVersion = PRISMA_CLIENT_VERSION;
  }

  return client;
}

let cachedClient: PrismaClient | undefined;

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (!cachedClient) {
      cachedClient = getPrismaClient();
    }
    return Reflect.get(cachedClient, prop, receiver);
  },
});

export default prisma;
