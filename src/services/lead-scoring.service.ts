import { prisma } from "@/lib/db";

export type ScoreLabel = "HOT" | "WARM" | "COLD" | "DEAD" | "NEW";

export interface ScoreBreakdown {
  score: number;
  label: ScoreLabel;
  components: { rule: string; points: number }[];
}

function getLabel(score: number, hasActivity: boolean): ScoreLabel {
  if (!hasActivity) return "NEW";
  if (score >= 80) return "HOT";
  if (score >= 60) return "WARM";
  if (score >= 30) return "COLD";
  return "DEAD";
}

export class LeadScoringService {
  static async calculateScore(leadId: string): Promise<ScoreBreakdown> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        conversions: true,
        contactAttempts: true,
        sequenceEnrollments: {
          include: { sequence: true },
        },
      },
    });

    if (!lead) throw new Error(`Lead ${leadId} not found`);

    // Status overrides
    if (lead.status === "CONVERTED") {
      const breakdown: ScoreBreakdown = {
        score: 100,
        label: "HOT",
        components: [{ rule: "Status CONVERTED", points: 100 }],
      };
      await prisma.lead.update({
        where: { id: leadId },
        data: { score: 100, scoreLabel: "HOT", scoreUpdatedAt: new Date() },
      });
      return breakdown;
    }

    if (lead.status === "DO_NOT_CONTACT") {
      const breakdown: ScoreBreakdown = {
        score: 0,
        label: "DEAD",
        components: [{ rule: "Status DO_NOT_CONTACT", points: 0 }],
      };
      await prisma.lead.update({
        where: { id: leadId },
        data: { score: 0, scoreLabel: "DEAD", scoreUpdatedAt: new Date() },
      });
      return breakdown;
    }

    const components: { rule: string; points: number }[] = [];
    let total = 0;

    // Has email: +10
    if (lead.email) {
      components.push({ rule: "Has email", points: 10 });
      total += 10;
    }

    // Has phone: +10
    if (lead.phone) {
      components.push({ rule: "Has phone", points: 10 });
      total += 10;
    }

    // Source scoring
    if (lead.source === "META") {
      components.push({ rule: "Source META", points: 15 });
      total += 15;
    } else if (lead.source === "API") {
      components.push({ rule: "Source API", points: 10 });
      total += 10;
    } else if (lead.source === "MANUAL") {
      components.push({ rule: "Source MANUAL", points: 5 });
      total += 5;
    }

    // Has conversions (any): +30
    if (lead.conversions.length > 0) {
      components.push({ rule: "Has conversions", points: 30 });
      total += 30;
    }

    // Successful contact attempts: +10 per (max +20)
    const successfulAttempts = lead.contactAttempts.filter(
      (a) => a.status === "COMPLETED" || a.status === "ANSWERED"
    );
    if (successfulAttempts.length > 0) {
      const attemptPoints = Math.min(successfulAttempts.length * 10, 20);
      components.push({
        rule: `${successfulAttempts.length} successful contact(s)`,
        points: attemptPoints,
      });
      total += attemptPoints;
    }

    // Enrolled in active sequence: +5
    const activeEnrollment = lead.sequenceEnrollments.find(
      (e) => e.status === "ACTIVE" && e.sequence.status === "ACTIVE"
    );
    if (activeEnrollment) {
      components.push({ rule: "Enrolled in active sequence", points: 5 });
      total += 5;
    }

    // Lead age scoring
    const ageMs = Date.now() - lead.createdAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 24) {
      components.push({ rule: "Lead age < 24h", points: 10 });
      total += 10;
    } else if (ageHours < 7 * 24) {
      components.push({ rule: "Lead age < 7 days", points: 5 });
      total += 5;
    }

    // Cap at 100
    const score = Math.min(total, 100);
    const hasActivity =
      lead.conversions.length > 0 ||
      lead.contactAttempts.length > 0 ||
      lead.sequenceEnrollments.length > 0 ||
      lead.phone !== null ||
      lead.email !== null;
    const label = getLabel(score, hasActivity);

    await prisma.lead.update({
      where: { id: leadId },
      data: { score, scoreLabel: label, scoreUpdatedAt: new Date() },
    });

    return { score, label, components };
  }

  static async batchScoreLeads(limit = 100): Promise<{ scored: number }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { scoreUpdatedAt: null },
          { scoreUpdatedAt: { lt: oneHourAgo } },
        ],
      },
      select: { id: true },
      take: limit,
      orderBy: { scoreUpdatedAt: { sort: "asc", nulls: "first" } },
    });

    let scored = 0;
    for (const lead of leads) {
      try {
        await LeadScoringService.calculateScore(lead.id);
        scored++;
      } catch (e) {
        console.error(`Failed to score lead ${lead.id}:`, e);
      }
    }

    return { scored };
  }

  static async getScoreBreakdown(leadId: string): Promise<ScoreBreakdown> {
    return LeadScoringService.calculateScore(leadId);
  }

  static async getStats(): Promise<{
    total: number;
    distribution: Record<string, number>;
    avgScore: number;
  }> {
    const [total, byLabel] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({
        by: ["scoreLabel"],
        _count: true,
      }),
    ]);

    const allLeads = await prisma.lead.aggregate({
      _avg: { score: true },
    });

    return {
      total,
      distribution: Object.fromEntries(
        byLabel.map((g) => [g.scoreLabel, g._count])
      ),
      avgScore: Math.round(allLeads._avg.score ?? 0),
    };
  }
}
