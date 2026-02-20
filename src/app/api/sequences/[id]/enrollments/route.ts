import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enrollmentFiltersSchema } from "@/lib/validators";
import { verifyApiAuth, AuthError, authErrorResponse } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await verifyApiAuth(req);
    const { id } = await context.params;
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = enrollmentFiltersSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { status, page, pageSize } = parsed.data;

    const where: Record<string, unknown> = { sequenceId: id };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.sequenceEnrollment.findMany({
        where,
        orderBy: { enrolledAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          lead: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true },
          },
          executions: {
            orderBy: { scheduledAt: "asc" },
            select: { id: true, stepId: true, status: true, scheduledAt: true, executedAt: true },
          },
        },
      }),
      prisma.sequenceEnrollment.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("GET /api/sequences/[id]/enrollments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
