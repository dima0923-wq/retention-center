import { VapiSyncService } from "@/services/vapi-sync.service";

let intervalId: ReturnType<typeof setInterval> | null = null;

const SYNC_INTERVAL_MS = 30_000; // 30 seconds

export function startVapiAutoSync() {
  if (intervalId) return; // already running

  console.log("[VAPI AutoSync] Starting — every 30s");

  // Run immediately on start
  VapiSyncService.syncCalls()
    .then((r) => console.log(`[VAPI AutoSync] Initial sync: ${r.synced} calls`))
    .catch((e) => console.error("[VAPI AutoSync] Initial sync error:", e));

  intervalId = setInterval(async () => {
    try {
      const result = await VapiSyncService.syncCalls();
      if (result.synced > 0) {
        console.log(`[VAPI AutoSync] Synced ${result.synced} calls`);
      }
    } catch (e) {
      console.error("[VAPI AutoSync] Error:", e);
    }
  }, SYNC_INTERVAL_MS);
}
