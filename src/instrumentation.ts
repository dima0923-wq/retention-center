export async function onRequestInit() {
  // no-op — workers start in register()
}

export async function register() {
  // Only start workers on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize Sentry error tracking
    if (process.env.SENTRY_DSN) {
      const Sentry = await import("@sentry/nextjs");
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.SENTRY_ENVIRONMENT || "production",
        release: process.env.SENTRY_RELEASE || "retention-center@1.0.0",
        serverName: "ag2",
      });
    }

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
  err: Error,
  _request: { method: string; url: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string }
) => {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err, {
      tags: {
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
      },
    });
  }
};
