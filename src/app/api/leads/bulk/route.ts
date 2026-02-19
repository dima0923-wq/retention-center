import { NextRequest, NextResponse } from "next/server";
import { LeadService } from "@/services/lead.service";
import { leadBulkCreateSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = leadBulkCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await LeadService.bulkCreate(parsed.data.leads);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads/bulk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
