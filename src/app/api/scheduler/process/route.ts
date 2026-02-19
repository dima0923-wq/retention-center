import { NextResponse } from "next/server";
import { SchedulerService } from "@/services/scheduler.service";

export async function POST() {
  try {
    const result = await SchedulerService.processScheduledContacts();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing scheduled contacts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process scheduled contacts" },
      { status: 500 }
    );
  }
}
