import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ABTestService } from "@/services/ab-test.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const result = await ABTestService.getTestResults(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("AB test get error:", error);
    return NextResponse.json(
      { error: "Failed to fetch A/B test" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    const existing = await prisma.aBTest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "A/B test not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.status) {
      updateData.status = body.status;
      if (body.status === "COMPLETED" || body.status === "ENDED") {
        updateData.status = "COMPLETED";
        updateData.endedAt = new Date();
      }
    }

    if (body.winnerId) {
      updateData.winnerId = body.winnerId;
    }

    if (body.statsA) {
      updateData.statsA = JSON.stringify(body.statsA);
    }

    if (body.statsB) {
      updateData.statsB = JSON.stringify(body.statsB);
    }

    await prisma.aBTest.update({
      where: { id },
      data: updateData,
    });

    // Return fresh results via service
    const result = await ABTestService.getTestResults(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("AB test update error:", error);
    return NextResponse.json(
      { error: "Failed to update A/B test" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.aBTest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "A/B test not found" }, { status: 404 });
    }

    await prisma.aBTest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("AB test delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete A/B test" },
      { status: 500 }
    );
  }
}
