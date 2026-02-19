import { NextResponse } from "next/server";
import { LeadService } from "@/services/lead.service";

export async function GET() {
  try {
    const stats = await LeadService.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("GET /api/leads/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
