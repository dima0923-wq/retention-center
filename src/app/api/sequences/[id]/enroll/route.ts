import { NextRequest, NextResponse } from "next/server";
import { RetentionSequenceService } from "@/services/retention-sequence.service";
import { sequenceEnrollSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = sequenceEnrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const results = [];
    for (const leadId of parsed.data.leadIds) {
      try {
        const enrollment = await RetentionSequenceService.enrollLead(id, leadId);
        results.push({ leadId, status: "enrolled", enrollmentId: enrollment.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        results.push({ leadId, status: "failed", error: message });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") || message.includes("not active") ? 400 : 500;
    console.error("POST /api/sequences/[id]/enroll error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
