import { prisma } from "@/lib/db";

export interface DeliveryLogFilters {
  leadId?: string;
  status?: string;
  provider?: string;
  from?: string; // ISO date string
  to?: string; // ISO date string
  providerRef?: string;
  page?: number;
  limit?: number;
}

export class SmsDeliveryLogService {
  static async listEvents(filters: DeliveryLogFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.provider) {
      where.provider = filters.provider;
    }
    if (filters.providerRef) {
      where.providerRef = filters.providerRef;
    }
    if (filters.from || filters.to) {
      const receivedAt: Record<string, Date> = {};
      if (filters.from) receivedAt.gte = new Date(filters.from);
      if (filters.to) receivedAt.lte = new Date(filters.to);
      where.receivedAt = receivedAt;
    }
    if (filters.leadId) {
      where.contactAttempt = {
        leadId: filters.leadId,
      };
    }

    const [events, total] = await Promise.all([
      prisma.smsDeliveryEvent.findMany({
        where,
        include: {
          contactAttempt: {
            include: {
              lead: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
        },
        orderBy: { receivedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.smsDeliveryEvent.count({ where }),
    ]);

    const data = events.map((e) => ({
      id: e.id,
      contactAttemptId: e.contactAttemptId,
      providerRef: e.providerRef,
      provider: e.provider,
      status: e.status,
      rawStatus: e.rawStatus,
      receivedAt: e.receivedAt.toISOString(),
      ip: e.senderIp,
      lead: e.contactAttempt?.lead ?? null,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getEventsForAttempt(attemptId: string) {
    const attempt = await prisma.contactAttempt.findUnique({
      where: { id: attemptId },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        deliveryEvents: {
          orderBy: { receivedAt: "asc" },
        },
      },
    });

    if (!attempt) return null;

    return {
      attempt: {
        id: attempt.id,
        leadId: attempt.leadId,
        channel: attempt.channel,
        status: attempt.status,
        provider: attempt.provider,
        providerRef: attempt.providerRef,
        startedAt: attempt.startedAt.toISOString(),
        completedAt: attempt.completedAt?.toISOString() ?? null,
        lead: attempt.lead,
      },
      events: attempt.deliveryEvents.map((e) => ({
        id: e.id,
        status: e.status,
        rawStatus: e.rawStatus,
        rawPayload: e.rawPayload,
        receivedAt: e.receivedAt.toISOString(),
        ip: e.senderIp,
      })),
    };
  }

  static async getStats() {
    const [byStatus, byProvider] = await Promise.all([
      prisma.smsDeliveryEvent.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.smsDeliveryEvent.groupBy({
        by: ["provider"],
        _count: { id: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        count: p._count.id,
      })),
    };
  }
}
