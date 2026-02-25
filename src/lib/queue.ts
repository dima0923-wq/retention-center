import { Queue, type QueueOptions } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let connection: IORedis | null = null;
let redisAvailable = false;

function getConnection(): IORedis | null {
  if (connection) return connection;
  try {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
    });
    return connection;
  } catch {
    connection = null;
    return null;
  }
}

export async function isRedisAvailable(): Promise<boolean> {
  const conn = getConnection();
  if (!conn) return false;
  try {
    if (conn.status === "wait") await conn.connect();
    await conn.ping();
    redisAvailable = true;
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
}

export function isRedisConnected(): boolean {
  return redisAvailable;
}

const queues = new Map<string, Queue>();

function getOrCreateQueue(name: string): Queue | null {
  if (!redisAvailable) return null;
  if (queues.has(name)) return queues.get(name)!;
  const conn = getConnection();
  if (!conn) return null;
  const queue = new Queue(name, { connection: conn });
  queues.set(name, queue);
  return queue;
}

export function getQueueForChannel(channel: string): Queue | null {
  switch (channel) {
    case "SMS":
      return getOrCreateQueue("sms-queue");
    case "EMAIL":
      return getOrCreateQueue("email-queue");
    case "CALL":
      return getOrCreateQueue("call-queue");
    case "PUSH":
      return getOrCreateQueue("push-queue");
    default:
      return null;
  }
}

export async function addChannelJob(
  channel: string,
  data: Record<string, unknown>
): Promise<boolean> {
  if (!redisAvailable) return false;
  const queue = getQueueForChannel(channel);
  if (!queue) return false;
  try {
    await queue.add(`${channel.toLowerCase()}-send`, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
    return true;
  } catch {
    return false;
  }
}

async function closeQueues() {
  await Promise.allSettled([...queues.values()].map((q) => q.close()));
  queues.clear();
  if (connection) {
    await connection.quit().catch(() => {});
    connection = null;
  }
  redisAvailable = false;
}

process.on("SIGTERM", closeQueues);
process.on("SIGINT", closeQueues);
