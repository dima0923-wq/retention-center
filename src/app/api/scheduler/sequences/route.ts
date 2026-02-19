import { NextResponse } from "next/server";
import { SequenceProcessorService } from "@/services/sequence-processor.service";

export async function POST() {
  try {
    const result = await SequenceProcessorService.runAll();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing sequences:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process sequences" },
      { status: 500 }
    );
  }
}
