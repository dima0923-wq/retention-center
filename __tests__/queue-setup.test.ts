import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ioredis before importing queue module
vi.mock("ioredis", () => {
  const MockIORedis = vi.fn(function (this: Record<string, unknown>) {
    this.connect = vi.fn().mockRejectedValue(new Error("Redis unavailable"));
    this.ping = vi.fn().mockRejectedValue(new Error("Redis unavailable"));
    this.quit = vi.fn().mockResolvedValue("OK");
    this.status = "wait";
  });
  return { default: MockIORedis };
});

// Mock bullmq
vi.mock("bullmq", () => {
  const MockQueue = vi.fn(function (this: Record<string, unknown>, name: string) {
    this.name = name;
    this.add = vi.fn().mockResolvedValue({ id: "job-1" });
    this.close = vi.fn().mockResolvedValue(undefined);
  });
  const MockWorker = vi.fn(function (this: Record<string, unknown>) {
    this.on = vi.fn();
    this.close = vi.fn().mockResolvedValue(undefined);
  });
  return { Queue: MockQueue, Worker: MockWorker };
});

// Mock db to avoid DATABASE_URL requirement
vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn() },
    script: { findUnique: vi.fn() },
    contactAttempt: { update: vi.fn() },
    integrationConfig: { findUnique: vi.fn() },
  },
}));

describe("Queue Setup", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should export queue instances", async () => {
    const queue = await import("@/lib/queue");
    // isRedisConnected() should return false since we haven't connected
    expect(queue.isRedisConnected()).toBe(false);
  });

  it("should report Redis as unavailable when connection fails", async () => {
    const queue = await import("@/lib/queue");
    const available = await queue.isRedisAvailable();
    expect(available).toBe(false);
    expect(queue.isRedisConnected()).toBe(false);
  });

  it("should return null for all channels when Redis is unavailable", async () => {
    const queue = await import("@/lib/queue");
    // Queues are lazy — only created when redisAvailable is true
    expect(queue.getQueueForChannel("SMS")).toBeNull();
    expect(queue.getQueueForChannel("EMAIL")).toBeNull();
    expect(queue.getQueueForChannel("CALL")).toBeNull();
    expect(queue.getQueueForChannel("PUSH")).toBeNull();
    expect(queue.getQueueForChannel("UNKNOWN")).toBeNull();
  });

  it("should fail to enqueue when Redis is not connected", async () => {
    const queue = await import("@/lib/queue");
    // isRedisConnected() is false, so addChannelJob should return false
    const result = await queue.addChannelJob("SMS", {
      attemptId: "test-1",
      channel: "SMS",
      leadId: "lead-1",
      scriptId: "script-1",
    });
    expect(result).toBe(false);
  });

  it("should have addChannelJob and getQueueForChannel exports", async () => {
    const queue = await import("@/lib/queue");
    expect(typeof queue.addChannelJob).toBe("function");
    expect(typeof queue.getQueueForChannel).toBe("function");
    expect(typeof queue.isRedisAvailable).toBe("function");
    expect(typeof queue.isRedisConnected).toBe("function");
  });
});

describe("Channel Worker", () => {
  it("should export startWorkers and stopWorkers", async () => {
    const worker = await import("@/workers/channel-worker");
    expect(typeof worker.startWorkers).toBe("function");
    expect(typeof worker.stopWorkers).toBe("function");
  });
});
