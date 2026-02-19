import { NextRequest, NextResponse } from "next/server";
import { RetentionSequenceService } from "@/services/retention-sequence.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const stats = await RetentionSequenceService.getSequenceStats(id);
    if (!stats) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }
    return NextResponse.json(stats);
  } catch (error) {
    console.error("GET /api/sequences/[id]/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
