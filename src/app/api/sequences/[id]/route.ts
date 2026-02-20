import { NextRequest, NextResponse } from "next/server";
import { RetentionSequenceService } from "@/services/retention-sequence.service";
import { sequenceUpdateSchema } from "@/lib/validators";
import { verifyApiAuth, AuthError, authErrorResponse } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await verifyApiAuth(req);
    const { id } = await context.params;
    const sequence = await RetentionSequenceService.getById(id);
    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }
    return NextResponse.json(sequence);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/sequences/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    await verifyApiAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    const parsed = sequenceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const sequence = await RetentionSequenceService.update(id, parsed.data);
    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }
    return NextResponse.json(sequence);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Invalid status transition") ? 400 : 500;
    console.error("PUT /api/sequences/[id] error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    await verifyApiAuth(req);
    const { id } = await context.params;
    const result = await RetentionSequenceService.delete(id);
    if (!result) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("DELETE /api/sequences/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
