export async function onRequestInit() {
  // no-op — workers start in register()
}

export async function register() {
  // Only start workers on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Sentry integration disabled - @sentry/nextjs not compatible with Next.js 16

    const { isRedisAvailable } = await import("@/lib/queue");
    const available = await isRedisAvailable();
    if (available) {
      const { startWorkers } = await import("@/workers/channel-worker");
      const workers = startWorkers();
      console.log(
        `[BullMQ] Started ${workers.length} channel workers (sms, email, call, push)`
      );
    } else {
      console.warn(
        "[BullMQ] Redis not available — workers NOT started, using direct send fallback"
      );
    }
  }
}

export const onRequestError = async (
  _err: Error,
  _request: { method: string; url: string; headers: Record<string, string> },
  _context: { routerKind: string; routePath: string; routeType: string; renderSource: string }
) => {
  // Sentry integration disabled - @sentry/nextjs not compatible with Next.js 16
};
