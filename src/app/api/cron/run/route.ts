import { NextRequest, NextResponse } from "next/server";
import { SchedulerService } from "@/services/scheduler.service";
import { SequenceProcessorService } from "@/services/sequence-processor.service";
import { ChannelRouterService } from "@/services/channel/channel-router.service";
import { LeadScoringService } from "@/services/lead-scoring.service";
import { VapiSyncService } from "@/services/vapi-sync.service";

const CRON_SECRET = process.env.CRON_SECRET || "retention-cron-secret-2026";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") || req.headers.get("x-cron-secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // 1. Process scheduled contacts
  try {
    results.scheduledContacts = await SchedulerService.processScheduledContacts();
  } catch (e) {
    results.scheduledContacts = { error: (e as Error).message };
  }

  // 2. Process retention sequences
  try {
    results.sequences = await SequenceProcessorService.runAll();
  } catch (e) {
    results.sequences = { error: (e as Error).message };
  }

  // 3. Process pending contact queue
  try {
    results.contactQueue = await ChannelRouterService.processQueue();
  } catch (e) {
    results.contactQueue = { error: (e as Error).message };
  }

  // 4. Batch-score stale leads (scoreUpdatedAt older than 1 hour or null)
  try {
    results.leadScoring = await LeadScoringService.batchScoreLeads(100);
  } catch (e) {
    results.leadScoring = { error: (e as Error).message };
  }

  // 5. Sync VAPI calls from API
  try {
    results.vapiSync = await VapiSyncService.syncCalls();
  } catch (e) {
    results.vapiSync = { error: (e as Error).message };
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...results });
}

// Also support POST for flexibility
export { GET as POST };
