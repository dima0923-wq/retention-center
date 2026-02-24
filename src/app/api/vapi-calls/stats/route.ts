import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiAuth, AuthError, authErrorResponse, requirePermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiAuth(request);
    requirePermission(user, "retention:analytics:view");

    const [
      allCalls,
      endedCalls,
      failedCalls,
      withDuration,
      withCost,
      allCallsForCost,
      statusCounts,
    ] = await Promise.all([
      prisma.vapiCall.count(),
      prisma.vapiCall.count({ where: { status: "ended" } }),
      prisma.vapiCall.count({
        where: { status: { in: ["failed", "no-answer"] } },
      }),
      prisma.vapiCall.findMany({
        where: { duration: { not: null } },
        select: { duration: true },
      }),
      prisma.vapiCall.findMany({
        where: { cost: { not: null } },
        select: { cost: true, costBreakdown: true },
      }),
      prisma.vapiCall.findMany({
        select: { status: true },
      }),
      prisma.vapiCall.findMany({
        select: { status: true },
      }),
    ]);

    const totalDuration = withDuration.reduce((s, c) => s + (c.duration ?? 0), 0);
    const avgDuration = withDuration.length > 0
      ? Math.round(totalDuration / withDuration.length)
      : 0;

    const totalCost = withCost.reduce((s, c) => s + (c.cost ?? 0), 0);

    // Cost by type aggregation
    const costByType = { transport: 0, stt: 0, llm: 0, tts: 0, vapi: 0 };
    for (const c of withCost) {
      if (c.costBreakdown) {
        try {
          const bd = JSON.parse(c.costBreakdown) as Record<string, number>;
          if (bd.transport) costByType.transport += bd.transport;
          if (bd.stt) costByType.stt += bd.stt;
          if (bd.llm) costByType.llm += bd.llm;
          if (bd.tts) costByType.tts += bd.tts;
          if (bd.vapi) costByType.vapi += bd.vapi;
        } catch { /* skip invalid JSON */ }
      }
    }

    // Calls by status
    const callsByStatus: Record<string, number> = {};
    for (const c of statusCounts) {
      callsByStatus[c.status] = (callsByStatus[c.status] ?? 0) + 1;
    }

    // Calls by hour (last 24h)
    const now = new Date();
    const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentCalls = await prisma.vapiCall.findMany({
      where: { startedAt: { gte: h24ago } },
      select: { startedAt: true },
    });

    const callsByHour: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      const h = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      const key = `${h.getUTCHours().toString().padStart(2, "0")}:00`;
      callsByHour[key] = 0;
    }
    for (const c of recentCalls) {
      if (c.startedAt) {
        const key = `${c.startedAt.getUTCHours().toString().padStart(2, "0")}:00`;
        callsByHour[key] = (callsByHour[key] ?? 0) + 1;
      }
    }

    // Calls by day (last 30d)
    const d30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthlyCalls = await prisma.vapiCall.findMany({
      where: { startedAt: { gte: d30ago } },
      select: { startedAt: true },
    });

    const callsByDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      callsByDay[key] = 0;
    }
    for (const c of monthlyCalls) {
      if (c.startedAt) {
        const key = c.startedAt.toISOString().slice(0, 10);
        if (key in callsByDay) callsByDay[key]++;
      }
    }

    return NextResponse.json({
      totalCalls: allCalls,
      successfulCalls: endedCalls,
      failedCalls,
      avgDuration,
      totalCost: Math.round(totalCost * 100) / 100,
      costByType: Object.fromEntries(
        Object.entries(costByType).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
      callsByStatus,
      callsByHour,
      callsByDay,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to fetch VAPI call stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch VAPI call stats" },
      { status: 500 }
    );
  }
}
