import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Set DATABASE_URL before importing db module to avoid createPrismaClient error
process.env.DATABASE_URL = "file:./dev.db";

const { initDatabase } = await import("@/lib/db");

function createTestClient() {
  const adapter = new PrismaLibSql({ url: "file:./dev.db" });
  return new PrismaClient({ adapter });
}

describe("SQLite WAL mode", () => {
  let client: PrismaClient;

  beforeAll(async () => {
    client = createTestClient();
    await initDatabase(client);

    return async () => {
      await client.$disconnect();
    };
  });

  it("should enable WAL journal mode", async () => {
    const result = (await client.$queryRawUnsafe(
      "PRAGMA journal_mode"
    )) as Array<{ journal_mode: string }>;
    expect(result[0].journal_mode).toBe("wal");
  });

  it("should set busy_timeout to 5000", async () => {
    const result = (await client.$queryRawUnsafe(
      "PRAGMA busy_timeout"
    )) as Array<Record<string, unknown>>;
    // libsql may return the column as "timeout" or "busy_timeout"
    const value = result[0].busy_timeout ?? result[0].timeout ?? Object.values(result[0])[0];
    expect(value).toBe(5000);
  });

  it("should set synchronous to NORMAL (1)", async () => {
    const result = (await client.$queryRawUnsafe(
      "PRAGMA synchronous"
    )) as Array<{ synchronous: number }>;
    expect(result[0].synchronous).toBe(1);
  });

  it("should set cache_size to -64000 (64MB)", async () => {
    const result = (await client.$queryRawUnsafe(
      "PRAGMA cache_size"
    )) as Array<Record<string, unknown>>;
    const value = result[0].cache_size ?? Object.values(result[0])[0];
    expect(value).toBe(-64000);
  });

  it("should set mmap_size to 268435456 (256MB)", async () => {
    const result = (await client.$queryRawUnsafe(
      "PRAGMA mmap_size"
    )) as Array<Record<string, unknown>>;
    const value = result[0].mmap_size ?? Object.values(result[0])[0];
    expect(value).toBe(268435456);
  });
});
