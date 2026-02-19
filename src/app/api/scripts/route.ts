import { NextRequest, NextResponse } from "next/server";
import { ScriptService } from "@/services/script.service";
import { scriptCreateSchema, scriptFiltersSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = scriptFiltersSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const scripts = await ScriptService.list(parsed.data);
    return NextResponse.json(scripts);
  } catch (error) {
    console.error("GET /api/scripts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = scriptCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const script = await ScriptService.create(parsed.data);
    return NextResponse.json(script, { status: 201 });
  } catch (error) {
    console.error("POST /api/scripts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
