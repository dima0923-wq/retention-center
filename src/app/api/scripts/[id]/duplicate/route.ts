import { NextRequest, NextResponse } from "next/server";
import { ScriptService } from "@/services/script.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const script = await ScriptService.duplicate(id);
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    return NextResponse.json(script, { status: 201 });
  } catch (error) {
    console.error("POST /api/scripts/[id]/duplicate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
