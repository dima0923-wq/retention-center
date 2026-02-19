import { NextRequest, NextResponse } from "next/server";
import { LeadService } from "@/services/lead.service";
import { leadCreateSchema, leadFiltersSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = leadFiltersSchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid filters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, pageSize, sortBy, sortOrder, ...filters } = parsed.data;
    const result = await LeadService.list(
      filters,
      { page, pageSize },
      sortBy,
      sortOrder
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = leadCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await LeadService.create(parsed.data);

    return NextResponse.json(
      {
        lead: result.lead,
        deduplicated: result.deduplicated,
      },
      { status: result.deduplicated ? 200 : 201 }
    );
  } catch (error) {
    console.error("POST /api/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
