import { NextRequest, NextResponse } from "next/server";
import { RetentionSequenceService } from "@/services/retention-sequence.service";
import { sequenceCreateSchema, sequenceFiltersSchema } from "@/lib/validators";
import { verifyApiAuth, AuthError, authErrorResponse } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    await verifyApiAuth(req);
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = sequenceFiltersSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await RetentionSequenceService.list(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/sequences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyApiAuth(req);
    const body = await req.json();
    const parsed = sequenceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const sequence = await RetentionSequenceService.create(parsed.data);
    return NextResponse.json(sequence, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("POST /api/sequences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
