import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const status = url.searchParams.get("status") || undefined;
    const channel = url.searchParams.get("channel") || undefined;
    const campaignId = url.searchParams.get("campaignId") || url.searchParams.get("campaign") || undefined;
    const from = url.searchParams.get("from") || undefined;
    const to = url.searchParams.get("to") || undefined;
    const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
    const skip = Number(url.searchParams.get("skip")) || 0;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (campaignId) where.campaignId = campaignId;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
      };
    }

    const [conversions, total] = await Promise.all([
      prisma.conversion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.conversion.count({ where }),
    ]);

    return NextResponse.json({ data: conversions, total, limit, skip });
  } catch (error) {
    console.error("Conversions list error:", error);
    return NextResponse.json({ error: "Failed to fetch conversions" }, { status: 500 });
  }
}
