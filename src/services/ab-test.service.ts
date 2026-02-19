import { prisma } from "@/lib/db";

type ABStats = {
  sent: number;
  converted: number;
};

function parseStats(raw: string): ABStats {
  try {
    const parsed = JSON.parse(raw);
    return { sent: parsed.sent || 0, converted: parsed.converted || 0 };
  } catch {
    return { sent: 0, converted: 0 };
  }
}

/**
 * Z-test for two proportions. Returns the p-value (two-tailed).
 */
function twoProportionZTest(
  n1: number,
  c1: number,
  n2: number,
  c2: number
): { winner: "A" | "B" | null; confidence: number } {
  if (n1 === 0 || n2 === 0) return { winner: null, confidence: 0 };

  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pPool = (c1 + c2) / (n1 + n2);

  if (pPool === 0 || pPool === 1) return { winner: null, confidence: 0 };

  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return { winner: null, confidence: 0 };

  const z = (p1 - p2) / se;

  // Approximate two-tailed p-value using the error function
  const absZ = Math.abs(z);
  // Approximation of the cumulative normal distribution
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422804014327; // 1/sqrt(2*pi)
  const prob =
    d *
    Math.exp((-absZ * absZ) / 2) *
    (0.3193815 * t +
      -0.3565638 * t * t +
      1.781478 * t * t * t +
      -1.8212560 * t * t * t * t +
      1.3302744 * t * t * t * t * t);
  const pValue = 2 * prob;
  const confidence = (1 - pValue) * 100;

  let winner: "A" | "B" | null = null;
  if (confidence >= 95) {
    winner = p1 > p2 ? "A" : "B";
  }

  return { winner, confidence };
}

export class ABTestService {
  static async createTest(
    campaignId: string,
    channel: string,
    scriptIdA: string,
    scriptIdB: string
  ) {
    return prisma.aBTest.create({
      data: {
        campaignId,
        channel,
        variantA: scriptIdA,
        variantB: scriptIdB,
        status: "RUNNING",
        statsA: JSON.stringify({ sent: 0, converted: 0 }),
        statsB: JSON.stringify({ sent: 0, converted: 0 }),
      },
    });
  }

  static async getActiveTest(campaignId: string, channel: string) {
    return prisma.aBTest.findFirst({
      where: { campaignId, channel, status: "RUNNING" },
    });
  }

  static async selectVariant(
    testId: string
  ): Promise<{ variant: "A" | "B"; scriptId: string }> {
    const test = await prisma.aBTest.findUniqueOrThrow({
      where: { id: testId },
    });

    const variant: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
    const scriptId = variant === "A" ? test.variantA : test.variantB;

    return { variant, scriptId };
  }

  static async recordOutcome(
    testId: string,
    variant: "A" | "B",
    converted: boolean
  ) {
    const field = variant === "A" ? "statsA" : "statsB";
    await prisma.$transaction(async (tx) => {
      const test = await tx.aBTest.findUniqueOrThrow({ where: { id: testId } });
      const stats = parseStats(test[field]);
      stats.sent += 1;
      if (converted) stats.converted += 1;
      await tx.aBTest.update({
        where: { id: testId },
        data: { [field]: JSON.stringify(stats) },
      });
    });
  }

  static async evaluateTest(
    testId: string
  ): Promise<{ winner: "A" | "B" | null; confidence: number }> {
    const test = await prisma.aBTest.findUniqueOrThrow({
      where: { id: testId },
    });

    const a = parseStats(test.statsA);
    const b = parseStats(test.statsB);

    return twoProportionZTest(a.sent, a.converted, b.sent, b.converted);
  }

  static async autoEndTest(testId: string): Promise<boolean> {
    const test = await prisma.aBTest.findUniqueOrThrow({
      where: { id: testId },
    });
    if (test.status !== "RUNNING") return false;

    const a = parseStats(test.statsA);
    const b = parseStats(test.statsB);

    const totalSample = a.sent + b.sent;
    if (totalSample < 50) return false;

    const { winner, confidence } = twoProportionZTest(
      a.sent,
      a.converted,
      b.sent,
      b.converted
    );

    if (confidence >= 95 && winner) {
      const winnerId = winner === "A" ? test.variantA : test.variantB;
      await prisma.aBTest.update({
        where: { id: testId },
        data: {
          status: "COMPLETED",
          winnerId,
          endedAt: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  static async getTestResults(testId: string) {
    const test = await prisma.aBTest.findUniqueOrThrow({
      where: { id: testId },
    });

    const statsA = parseStats(test.statsA);
    const statsB = parseStats(test.statsB);
    const { winner, confidence } = twoProportionZTest(
      statsA.sent,
      statsA.converted,
      statsB.sent,
      statsB.converted
    );

    return {
      id: test.id,
      campaignId: test.campaignId,
      channel: test.channel,
      status: test.status,
      variantA: test.variantA,
      variantB: test.variantB,
      statsA,
      statsB,
      winner,
      winnerId: test.winnerId,
      confidence,
      startedAt: test.startedAt,
      endedAt: test.endedAt,
    };
  }
}
