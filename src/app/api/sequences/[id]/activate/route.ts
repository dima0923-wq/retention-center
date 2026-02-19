import { NextRequest, NextResponse } from "next/server";
import { RetentionSequenceService } from "@/services/retention-sequence.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sequence = await RetentionSequenceService.activate(id);
    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }
    return NextResponse.json(sequence);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Cannot activate") || message.includes("no steps") ? 400 : 500;
    console.error("POST /api/sequences/[id]/activate error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
