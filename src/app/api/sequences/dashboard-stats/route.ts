import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Active sequences count
    const activeSequences = await prisma.retentionSequence.count({
      where: { status: "ACTIVE" },
    });

    // Total sequences count
    const totalSequences = await prisma.retentionSequence.count({
      where: { status: { not: "ARCHIVED" } },
    });

    // Enrollment stats
    const enrollmentStats = await prisma.sequenceEnrollment.groupBy({
      by: ["status"],
      _count: true,
    });

    // totalEverEnrolled includes all historical enrollments (active, completed, converted, cancelled)
    let totalEverEnrolled = 0;
    let activeEnrollments = 0;
    let completedEnrollments = 0;
    let convertedEnrollments = 0;
    for (const row of enrollmentStats) {
      totalEverEnrolled += row._count;
      if (row.status === "ACTIVE") activeEnrollments = row._count;
      if (row.status === "COMPLETED") completedEnrollments = row._count;
      if (row.status === "CONVERTED") convertedEnrollments = row._count;
    }

    // Conversion rate: converted / (completed + converted) or 0
    const finishedTotal = completedEnrollments + convertedEnrollments;
    const conversionRate =
      finishedTotal > 0
        ? Math.round((convertedEnrollments / finishedTotal) * 1000) / 10
        : 0;

    // Upcoming scheduled steps (next 10)
    const upcomingSteps = await prisma.sequenceStepExecution.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { gte: new Date() },
        enrollment: { status: "ACTIVE" },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
      include: {
        step: { select: { channel: true, stepOrder: true } },
        enrollment: {
          select: {
            lead: {
              select: { firstName: true, lastName: true, email: true },
            },
            sequence: { select: { name: true } },
          },
        },
      },
    });

    // Recent executions (last 20 executed)
    const recentExecutions = await prisma.sequenceStepExecution.findMany({
      where: {
        status: { in: ["SENT", "DELIVERED", "FAILED", "SKIPPED"] },
        executedAt: { not: null },
      },
      orderBy: { executedAt: "desc" },
      take: 20,
      include: {
        step: { select: { channel: true, stepOrder: true } },
        enrollment: {
          select: {
            lead: {
              select: { firstName: true, lastName: true },
            },
            sequence: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      activeSequences,
      totalSequences,
      totalEverEnrolled,
      activeEnrollments,
      completedEnrollments,
      convertedEnrollments,
      conversionRate,
      upcomingSteps: upcomingSteps.map((e) => ({
        id: e.id,
        scheduledAt: e.scheduledAt,
        channel: e.step.channel,
        stepOrder: e.step.stepOrder,
        leadName: `${e.enrollment.lead.firstName} ${e.enrollment.lead.lastName}`,
        leadEmail: e.enrollment.lead.email,
        sequenceName: e.enrollment.sequence.name,
      })),
      recentActivity: recentExecutions.map((e) => ({
        id: e.id,
        status: e.status,
        executedAt: e.executedAt,
        channel: e.step.channel,
        stepOrder: e.step.stepOrder,
        leadName: `${e.enrollment.lead.firstName} ${e.enrollment.lead.lastName}`,
        sequenceName: e.enrollment.sequence.name,
      })),
    });
  } catch (error) {
    console.error("GET /api/sequences/dashboard-stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
