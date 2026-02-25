import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const initializedClients = new WeakSet<PrismaClient>();

export async function initDatabase(client: PrismaClient) {
  if (initializedClients.has(client)) return;
  await client.$executeRawUnsafe("PRAGMA journal_mode=WAL");
  await client.$executeRawUnsafe("PRAGMA busy_timeout=5000");
  await client.$executeRawUnsafe("PRAGMA synchronous=NORMAL");
  await client.$executeRawUnsafe("PRAGMA cache_size=-64000");
  await client.$executeRawUnsafe("PRAGMA mmap_size=268435456");
  initializedClients.add(client);
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL environment variable is required");
  const adapter = new PrismaLibSql({ url: dbUrl });
  const client = new PrismaClient({ adapter });
  // Fire-and-forget: initialize WAL mode on first connection
  initDatabase(client).catch((e) =>
    console.error("Failed to set SQLite PRAGMAs:", e)
  );
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
