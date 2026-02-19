import { NextRequest, NextResponse } from "next/server";
import { RetentionSequenceService } from "@/services/retention-sequence.service";
import { sequenceCreateSchema, sequenceFiltersSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = sequenceFiltersSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await RetentionSequenceService.list(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/sequences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = sequenceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const sequence = await RetentionSequenceService.create(parsed.data);
    return NextResponse.json(sequence, { status: 201 });
  } catch (error) {
    console.error("POST /api/sequences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
