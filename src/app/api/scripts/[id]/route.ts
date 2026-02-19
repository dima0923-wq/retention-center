import { NextRequest, NextResponse } from "next/server";
import { ScriptService } from "@/services/script.service";
import { scriptUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const script = await ScriptService.getById(id);
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    return NextResponse.json(script);
  } catch (error) {
    console.error("GET /api/scripts/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = scriptUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const script = await ScriptService.update(id, parsed.data);
    return NextResponse.json(script);
  } catch (error) {
    console.error("PATCH /api/scripts/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const script = await ScriptService.delete(id);
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("active campaign")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("DELETE /api/scripts/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
