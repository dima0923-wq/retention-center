import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ABTestService } from "@/services/ab-test.service";
import { z } from "zod";
import { verifyApiAuth, authErrorResponse, AuthError } from "@/lib/api-auth";

const abTestCreateSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID is required"),
  channel: z.enum(["CALL", "SMS", "EMAIL"]),
  variantA: z.string().min(1, "Variant A script ID is required"),
  variantB: z.string().min(1, "Variant B script ID is required"),
});

export async function GET(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    const url = req.nextUrl;
    const campaignId = url.searchParams.get("campaignId") || undefined;
    const status = url.searchParams.get("status") || undefined;

    const tests = await prisma.aBTest.findMany({
      where: {
        ...(campaignId ? { campaignId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { startedAt: "desc" },
    });

    const enriched = tests.map((t) => ({
      ...t,
      statsA: safeParseJson(t.statsA),
      statsB: safeParseJson(t.statsB),
    }));

    return NextResponse.json({ data: enriched, total: enriched.length });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("AB tests list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch A/B tests" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyApiAuth(req);
    const body = await req.json();
    const parsed = abTestCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const test = await ABTestService.createTest(
      parsed.data.campaignId,
      parsed.data.channel,
      parsed.data.variantA,
      parsed.data.variantB
    );

    return NextResponse.json(test, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("AB test create error:", error);
    return NextResponse.json(
      { error: "Failed to create A/B test" },
      { status: 500 }
    );
  }
}

function safeParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
