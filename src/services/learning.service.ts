import { prisma } from "@/lib/db";

// English stop words to filter out during tokenization
const STOP_WORDS = new Set([
  "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your",
  "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her",
  "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs",
  "themselves", "what", "which", "who", "whom", "this", "that", "these", "those",
  "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if",
  "or", "because", "as", "until", "while", "of", "at", "by", "for", "with",
  "about", "against", "between", "through", "during", "before", "after", "above",
  "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under",
  "again", "further", "then", "once", "here", "there", "when", "where", "why",
  "how", "all", "both", "each", "few", "more", "most", "other", "some", "such",
  "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s",
  "t", "can", "will", "just", "don", "should", "now", "d", "ll", "m", "o", "re",
  "ve", "y", "ain", "aren", "couldn", "didn", "doesn", "hadn", "hasn", "haven",
  "isn", "ma", "mightn", "mustn", "needn", "shan", "shouldn", "wasn", "weren",
  "won", "wouldn",
]);

/** Tokenize text: lowercase, remove punctuation, filter stop words and short tokens */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Simple z-test for comparing two proportions. Returns z-score. */
function zTest(p1: number, n1: number, p2: number, n2: number): number {
  const p = (p1 * n1 + p2 * n2) / (n1 + n2);
  if (p === 0 || p === 1) return 0;
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return 0;
  return (p1 - p2) / se;
}

/** Convert z-score to approximate confidence (0-1) using sigmoid-like mapping */
function zToConfidence(z: number): number {
  const absZ = Math.abs(z);
  // Map: z=1.65 -> ~0.9, z=1.96 -> ~0.95, z=2.58 -> ~0.99
  if (absZ >= 2.58) return 0.99;
  if (absZ >= 1.96) return 0.95;
  if (absZ >= 1.65) return 0.9;
  if (absZ >= 1.28) return 0.8;
  return Math.min(0.7, absZ / 1.28 * 0.7);
}

type DateFilter = { gte?: Date; lte?: Date };

function buildDateFilter(startDate?: Date, endDate?: Date): DateFilter | undefined {
  const f: DateFilter = {};
  if (startDate) f.gte = startDate;
  if (endDate) f.lte = endDate;
  return Object.keys(f).length > 0 ? f : undefined;
}

export class LearningService {
  /**
   * Analyze all conversions for a channel.
   * Returns aggregated stats: total attempts, conversions, rate, revenue, by status.
   */
  static async analyzeConversions(
    channel?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const dateFilter = buildDateFilter(startDate, endDate);

    const attemptWhere: Record<string, unknown> = {};
    if (channel) attemptWhere.channel = channel;
    if (dateFilter) attemptWhere.startedAt = dateFilter;

    const conversionWhere: Record<string, unknown> = {};
    if (channel) conversionWhere.channel = channel;
    if (dateFilter) conversionWhere.createdAt = dateFilter;

    const [attempts, conversions, revenueAgg, conversionsByStatus] =
      await Promise.all([
        prisma.contactAttempt.count({ where: attemptWhere }),
        prisma.conversion.count({ where: conversionWhere }),
        prisma.conversion.aggregate({
          where: conversionWhere,
          _sum: { revenue: true },
          _avg: { revenue: true },
        }),
        prisma.conversion.groupBy({
          by: ["status"],
          _count: true,
          _sum: { revenue: true },
          where: conversionWhere,
        }),
      ]);

    const conversionRate =
      attempts > 0 ? Math.round((conversions / attempts) * 1000) / 10 : 0;

    return {
      totalAttempts: attempts,
      totalConversions: conversions,
      conversionRate,
      totalRevenue: revenueAgg._sum.revenue ?? 0,
      avgRevenue: revenueAgg._avg.revenue
        ? Math.round(revenueAgg._avg.revenue * 100) / 100
        : 0,
      byStatus: conversionsByStatus.map((s) => ({
        status: s.status,
        count: s._count,
        revenue: s._sum.revenue ?? 0,
      })),
    };
  }

  /**
   * Get top performing words ranked by conversion rate.
   * Tokenizes script content, correlates with conversion outcomes.
   * Requires minimum 10 sample size per word.
   */
  static async getTopPerformingWords(channel: string, limit = 20, sortDir: "desc" | "asc" = "desc") {
    const MIN_SAMPLE = 10;

    // Get all contact attempts for this channel that have scripts
    const attempts = await prisma.contactAttempt.findMany({
      where: { channel, scriptId: { not: null } },
      select: {
        id: true,
        scriptId: true,
        status: true,
        script: { select: { content: true } },
      },
    });

    // Build word -> { total, converted } map
    const wordStats = new Map<
      string,
      { total: number; converted: number }
    >();

    // Get conversion contact attempt IDs
    const conversionAttemptIds = new Set(
      (
        await prisma.conversion.findMany({
          where: { channel, contactAttemptId: { not: null } },
          select: { contactAttemptId: true },
        })
      )
        .map((c) => c.contactAttemptId)
        .filter(Boolean) as string[]
    );

    // Also count SUCCESS status as conversion if no explicit conversion record
    for (const attempt of attempts) {
      if (!attempt.script?.content) continue;
      const words = tokenize(attempt.script.content);
      const uniqueWords = new Set(words);
      const isConverted =
        conversionAttemptIds.has(attempt.id) || attempt.status === "SUCCESS";

      for (const word of uniqueWords) {
        const stat = wordStats.get(word) ?? { total: 0, converted: 0 };
        stat.total++;
        if (isConverted) stat.converted++;
        wordStats.set(word, stat);
      }
    }

    // Calculate overall conversion rate for z-test baseline
    const totalAttempts = attempts.length;
    const totalConverted = attempts.filter(
      (a) => conversionAttemptIds.has(a.id) || a.status === "SUCCESS"
    ).length;
    const baseRate = totalAttempts > 0 ? totalConverted / totalAttempts : 0;

    // Filter by minimum sample size, compute stats
    const results = Array.from(wordStats.entries())
      .filter(([, s]) => s.total >= MIN_SAMPLE)
      .map(([word, s]) => {
        const rate = s.converted / s.total;
        const z = zTest(rate, s.total, baseRate, totalAttempts - s.total);
        const confidence = zToConfidence(z);
        return {
          word,
          conversionRate: Math.round(rate * 1000) / 10,
          sampleSize: s.total,
          converted: s.converted,
          lift: baseRate > 0 ? Math.round((rate / baseRate - 1) * 100) : 0,
          confidence: Math.round(confidence * 100) / 100,
        };
      })
      .sort((a, b) =>
        sortDir === "asc"
          ? a.conversionRate - b.conversionRate
          : b.conversionRate - a.conversionRate
      )
      .slice(0, limit);

    return {
      baseConversionRate: Math.round(baseRate * 1000) / 10,
      totalAttempts,
      words: results,
    };
  }

  /**
   * Suggest optimal script for a campaign.
   * Returns best/worst words, optimal time, and template suggestion.
   */
  static async suggestOptimalScript(channel: string, campaignId?: string) {
    const [topWords, bottomWords, timeAnalysis] = await Promise.all([
      LearningService.getTopPerformingWords(channel, 10),
      LearningService.getTopPerformingWords(channel, 10, "asc"),
      LearningService.getTimeAnalysis(channel),
    ]);

    // Find best time slot
    let optimalTime = { dayOfWeek: 1, hour: 10, conversionRate: 0 };
    for (const slot of timeAnalysis.heatmap) {
      if (slot.conversionRate > optimalTime.conversionRate) {
        optimalTime = slot;
      }
    }

    const dayNames = [
      "Sunday", "Monday", "Tuesday", "Wednesday",
      "Thursday", "Friday", "Saturday",
    ];

    // Get best performing script if campaignId provided
    let templateSuggestion: string | null = null;
    if (campaignId) {
      const bestScript = await prisma.contactAttempt.groupBy({
        by: ["scriptId"],
        _count: true,
        where: {
          campaignId,
          channel,
          status: "SUCCESS",
          scriptId: { not: null },
        },
        orderBy: { _count: { scriptId: "desc" } },
        take: 1,
      });

      if (bestScript.length > 0 && bestScript[0].scriptId) {
        const script = await prisma.script.findUnique({
          where: { id: bestScript[0].scriptId },
          select: { content: true, name: true },
        });
        templateSuggestion = script?.content ?? null;
      }
    }

    return {
      bestWords: topWords.words.map((w) => w.word),
      worstWords: bottomWords.words.map((w) => w.word),
      optimalTime: {
        dayOfWeek: optimalTime.dayOfWeek,
        dayName: dayNames[optimalTime.dayOfWeek],
        hour: optimalTime.hour,
        conversionRate: optimalTime.conversionRate,
      },
      templateSuggestion,
      baseConversionRate: topWords.baseConversionRate,
    };
  }

  /**
   * Get full conversion funnel.
   * Leads -> Contacted -> Responded -> Converted -> Revenue
   */
  static async getConversionFunnel(campaignId?: string) {
    const leadWhere: Record<string, unknown> = {};
    const attemptWhere: Record<string, unknown> = {};
    const conversionWhere: Record<string, unknown> = {};

    if (campaignId) {
      // Get lead IDs from campaign
      const campaignLeads = await prisma.campaignLead.findMany({
        where: { campaignId },
        select: { leadId: true },
      });
      const leadIds = campaignLeads.map((cl) => cl.leadId);
      leadWhere.id = { in: leadIds };
      attemptWhere.campaignId = campaignId;
      conversionWhere.campaignId = campaignId;
    }

    const [
      totalLeads,
      contactedLeads,
      respondedAttempts,
      convertedLeads,
      revenueAgg,
    ] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.contactAttempt.groupBy({
        by: ["leadId"],
        where: attemptWhere,
      }).then((r) => r.length),
      prisma.contactAttempt.count({
        where: { ...attemptWhere, status: "SUCCESS" },
      }),
      prisma.lead.count({
        where: { ...leadWhere, status: "CONVERTED" },
      }),
      prisma.conversion.aggregate({
        where: conversionWhere,
        _sum: { revenue: true },
      }),
    ]);

    const funnel = [
      { stage: "Leads", count: totalLeads },
      { stage: "Contacted", count: contactedLeads },
      { stage: "Responded", count: respondedAttempts },
      { stage: "Converted", count: convertedLeads },
      {
        stage: "Revenue",
        count: convertedLeads,
        value: revenueAgg._sum.revenue ?? 0,
      },
    ];

    // Add drop-off rates
    return funnel.map((step, i) => ({
      ...step,
      dropOff:
        i > 0 && funnel[i - 1].count > 0
          ? Math.round(
              (1 - step.count / funnel[i - 1].count) * 1000
            ) / 10
          : 0,
    }));
  }

  /**
   * Auto-generate text insights from conversion data.
   * E.g. "Scripts with 'exclusive' convert 3x better"
   */
  static async generateInsights(campaignId?: string) {
    const insights: string[] = [];

    // Get channels in use
    const channelGroups = await prisma.contactAttempt.groupBy({
      by: ["channel"],
      _count: true,
      where: campaignId ? { campaignId } : undefined,
    });
    const channels = channelGroups.map((g) => g.channel);

    // Per-channel word insights, time insights, and channel comparison — all in parallel
    await Promise.all(channels.map(async (channel) => {
      const [wordData, timeData, convStats] = await Promise.all([
        LearningService.getTopPerformingWords(channel, 5),
        LearningService.getTimeAnalysis(channel),
        LearningService.analyzeConversions(channel),
      ]);

      // Word insights
      if (wordData.words.length > 0) {
        const best = wordData.words[0];
        if (best.lift > 50) {
          const multiplier = Math.round((best.lift + 100) / 100 * 10) / 10;
          insights.push(
            `${channel}: Scripts with "${best.word}" convert ${multiplier}x better (${best.sampleSize} samples, ${best.confidence * 100}% confidence)`
          );
        }
      }

      // Time-of-day insights
      if (timeData.heatmap.length > 0) {
        const sorted = [...timeData.heatmap]
          .filter((s) => s.total >= 5)
          .sort((a, b) => b.conversionRate - a.conversionRate);

        if (sorted.length >= 2) {
          const best = sorted[0];
          const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const timeStr = `${best.hour}:00-${best.hour + 1}:00`;
          insights.push(
            `${channel}: ${dayNames[best.dayOfWeek]} ${timeStr} has ${best.conversionRate}% conversion rate (highest)`
          );
        }
      }

      return { channel, rate: convStats.conversionRate };
    }));

    // Channel comparison insight (uses already-available data, re-fetch is cheap since parallelized above)
    if (channels.length >= 2) {
      const channelRates = await Promise.all(
        channels.map(async (channel) => {
          const stats = await LearningService.analyzeConversions(channel);
          return { channel, rate: stats.conversionRate };
        })
      );
      channelRates.sort((a, b) => b.rate - a.rate);
      if (channelRates[0].rate > 0) {
        insights.push(
          `${channelRates[0].channel} is the best converting channel at ${channelRates[0].rate}%`
        );
      }
    }

    // Funnel insight
    const funnel = await LearningService.getConversionFunnel(campaignId);
    const biggestDrop = funnel.reduce(
      (max, step) => (step.dropOff > max.dropOff ? step : max),
      { stage: "", dropOff: 0, count: 0 }
    );
    if (biggestDrop.dropOff > 30) {
      const prevStage = funnel[funnel.findIndex((s) => s.stage === biggestDrop.stage) - 1];
      if (prevStage) {
        insights.push(
          `Biggest drop-off: ${prevStage.stage} → ${biggestDrop.stage} (${biggestDrop.dropOff}% loss)`
        );
      }
    }

    return insights;
  }

  /**
   * Time-of-day analysis.
   * Returns heatmap data: day of week x hour -> conversion rate
   */
  static async getTimeAnalysis(channel?: string) {
    const where: Record<string, unknown> = {};
    if (channel) where.channel = channel;

    const attempts = await prisma.contactAttempt.findMany({
      where,
      select: {
        id: true,
        startedAt: true,
        status: true,
      },
    });

    // Get conversion attempt IDs
    const conversionWhere: Record<string, unknown> = {};
    if (channel) conversionWhere.channel = channel;
    conversionWhere.contactAttemptId = { not: null };

    const conversionAttemptIds = new Set(
      (
        await prisma.conversion.findMany({
          where: conversionWhere,
          select: { contactAttemptId: true },
        })
      )
        .map((c) => c.contactAttemptId)
        .filter(Boolean) as string[]
    );

    // Build heatmap: [dayOfWeek][hour] -> { total, converted }
    const heatmap = new Map<string, { total: number; converted: number }>();

    for (const attempt of attempts) {
      const date = new Date(attempt.startedAt);
      const day = date.getDay();
      const hour = date.getHours();
      const key = `${day}-${hour}`;

      const slot = heatmap.get(key) ?? { total: 0, converted: 0 };
      slot.total++;
      if (conversionAttemptIds.has(attempt.id) || attempt.status === "SUCCESS") {
        slot.converted++;
      }
      heatmap.set(key, slot);
    }

    const result = Array.from(heatmap.entries()).map(([key, stats]) => {
      const [day, hour] = key.split("-").map(Number);
      return {
        dayOfWeek: day,
        hour,
        total: stats.total,
        converted: stats.converted,
        conversionRate:
          stats.total > 0
            ? Math.round((stats.converted / stats.total) * 1000) / 10
            : 0,
      };
    });

    return { heatmap: result };
  }

  /**
   * Update conversion rules (run periodically).
   * Recalculates ConversionRule table from fresh data.
   */
  static async updateConversionRules() {
    const channels = await prisma.contactAttempt.groupBy({
      by: ["channel"],
      _count: true,
    });

    const rules: Array<{
      channel: string;
      metric: string;
      value: string;
      conversionRate: number;
      sampleSize: number;
      confidence: number;
    }> = [];

    for (const { channel } of channels) {
      // Word-based rules
      const wordData = await LearningService.getTopPerformingWords(channel, 20);
      for (const w of wordData.words) {
        if (w.confidence >= 0.8) {
          rules.push({
            channel,
            metric: "word",
            value: w.word,
            conversionRate: w.conversionRate,
            sampleSize: w.sampleSize,
            confidence: w.confidence,
          });
        }
      }

      // Time-based rules
      const timeData = await LearningService.getTimeAnalysis(channel);
      const topSlots = timeData.heatmap
        .filter((s) => s.total >= 10)
        .sort((a, b) => b.conversionRate - a.conversionRate)
        .slice(0, 5);

      for (const slot of topSlots) {
        rules.push({
          channel,
          metric: "time_slot",
          value: `${slot.dayOfWeek}-${slot.hour}`,
          conversionRate: slot.conversionRate,
          sampleSize: slot.total,
          confidence: slot.total >= 30 ? 0.9 : slot.total >= 20 ? 0.8 : 0.7,
        });
      }
    }

    // Upsert rules: delete old, insert new
    await prisma.$transaction([
      prisma.conversionRule.deleteMany({}),
      ...rules.map((r) =>
        prisma.conversionRule.create({ data: r })
      ),
    ]);

    return { rulesUpdated: rules.length };
  }

  /**
   * Sequence Performance Analytics.
   * Returns per-sequence stats: conversion rate, step drop-off, delay timing analysis.
   */
  static async getSequencePerformance() {
    const sequences = await prisma.retentionSequence.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] } },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        enrollments: {
          select: { status: true },
        },
      },
    });

    const results = await Promise.all(sequences.map(async (seq) => {
      const totalEnrolled = seq.enrollments.length;
      const converted = seq.enrollments.filter(
        (e) => e.status === "CONVERTED"
      ).length;
      const completed = seq.enrollments.filter(
        (e) => e.status === "COMPLETED"
      ).length;
      const active = seq.enrollments.filter(
        (e) => e.status === "ACTIVE"
      ).length;
      const conversionRate =
        totalEnrolled > 0
          ? Math.round((converted / totalEnrolled) * 1000) / 10
          : 0;

      // Step drop-off analysis using aggregation instead of loading all executions
      const stepStatsAgg = await prisma.sequenceStepExecution.groupBy({
        by: ["stepId", "status"],
        where: { enrollment: { sequenceId: seq.id } },
        _count: true,
      });

      // Build a lookup: stepId -> Map<status, count>
      const stepCountMap = new Map<string, Map<string, number>>();
      for (const row of stepStatsAgg) {
        if (!stepCountMap.has(row.stepId)) stepCountMap.set(row.stepId, new Map());
        stepCountMap.get(row.stepId)!.set(row.status, row._count);
      }

      const stepStats = seq.steps.map((step) => {
        const counts = stepCountMap.get(step.id) ?? new Map<string, number>();
        const sent = (counts.get("SENT") ?? 0) + (counts.get("DELIVERED") ?? 0);
        const failed = counts.get("FAILED") ?? 0;
        const skipped = counts.get("SKIPPED") ?? 0;
        const pending = (counts.get("PENDING") ?? 0) + (counts.get("SCHEDULED") ?? 0);
        const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);

        return {
          stepOrder: step.stepOrder,
          channel: step.channel,
          delayValue: step.delayValue,
          delayUnit: step.delayUnit,
          total,
          sent,
          failed,
          skipped,
          pending,
          dropOffRate:
            total > 0
              ? Math.round(((failed + skipped) / total) * 1000) / 10
              : 0,
        };
      });

      let channels: string[] = [];
      try { channels = JSON.parse(seq.channels) as string[]; } catch {}

      return {
        id: seq.id,
        name: seq.name,
        status: seq.status,
        channels,
        totalEnrolled,
        converted,
        completed,
        active,
        conversionRate,
        steps: stepStats,
      };
    }));

    // Sort by conversion rate descending
    results.sort((a, b) => b.conversionRate - a.conversionRate);

    return { sequences: results };
  }

  /**
   * Channel Mix Analysis.
   * Compares multi-channel vs single-channel sequence performance.
   */
  static async getChannelMixAnalysis() {
    const sequences = await prisma.retentionSequence.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED", "ARCHIVED"] } },
      include: {
        steps: true,
        enrollments: true,
      },
    });

    // Group by channel combination
    const combos = new Map<
      string,
      { totalEnrolled: number; converted: number; sequences: number }
    >();

    for (const seq of sequences) {
      const channels = [
        ...new Set(seq.steps.map((s) => s.channel)),
      ].sort();
      const key = channels.join("+") || "none";

      const entry = combos.get(key) ?? {
        totalEnrolled: 0,
        converted: 0,
        sequences: 0,
      };
      entry.sequences++;
      entry.totalEnrolled += seq.enrollments.length;
      entry.converted += seq.enrollments.filter(
        (e) => e.status === "CONVERTED"
      ).length;
      combos.set(key, entry);
    }

    const channelMix = Array.from(combos.entries())
      .map(([channels, stats]) => ({
        channels,
        channelCount: channels.split("+").length,
        sequences: stats.sequences,
        totalEnrolled: stats.totalEnrolled,
        converted: stats.converted,
        conversionRate:
          stats.totalEnrolled > 0
            ? Math.round(
                (stats.converted / stats.totalEnrolled) * 1000
              ) / 10
            : 0,
      }))
      .sort((a, b) => b.conversionRate - a.conversionRate);

    // Delay timing analysis
    const delayPerformance = new Map<
      string,
      { totalEnrolled: number; converted: number }
    >();

    for (const seq of sequences) {
      for (const step of seq.steps) {
        const delayKey = `${step.delayValue}${step.delayUnit.charAt(0).toLowerCase()}`;
        const entry = delayPerformance.get(delayKey) ?? {
          totalEnrolled: 0,
          converted: 0,
        };
        entry.totalEnrolled += seq.enrollments.length;
        entry.converted += seq.enrollments.filter(
          (e) => e.status === "CONVERTED"
        ).length;
        delayPerformance.set(delayKey, entry);
      }
    }

    const delayAnalysis = Array.from(delayPerformance.entries())
      .map(([delay, stats]) => ({
        delay,
        totalEnrolled: stats.totalEnrolled,
        converted: stats.converted,
        conversionRate:
          stats.totalEnrolled > 0
            ? Math.round(
                (stats.converted / stats.totalEnrolled) * 1000
              ) / 10
            : 0,
      }))
      .sort((a, b) => b.conversionRate - a.conversionRate);

    return { channelMix, delayAnalysis };
  }

  /**
   * Generate actionable recommendations based on sequence data.
   */
  static async getRecommendations() {
    const recommendations: Array<{
      type: "create" | "pause" | "optimize";
      priority: "high" | "medium" | "low";
      text: string;
    }> = [];

    const sequences = await prisma.retentionSequence.findMany({
      where: { status: "ACTIVE" },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        enrollments: true,
      },
    });

    // Batch-fetch all step executions to avoid N+1 queries
    const allStepIds = sequences.flatMap((s) => s.steps.map((st) => st.id));
    const allExecs = await prisma.sequenceStepExecution.findMany({
      where: { stepId: { in: allStepIds } },
      select: { stepId: true, status: true },
    });
    const execsByStep = new Map<string, typeof allExecs>();
    for (const e of allExecs) {
      const arr = execsByStep.get(e.stepId) ?? [];
      arr.push(e);
      execsByStep.set(e.stepId, arr);
    }

    for (const seq of sequences) {
      const totalEnrolled = seq.enrollments.length;
      if (totalEnrolled < 5) continue;

      const converted = seq.enrollments.filter(
        (e) => e.status === "CONVERTED"
      ).length;
      const convRate = converted / totalEnrolled;

      // Low conversion rate warning
      if (convRate < 0.02 && totalEnrolled >= 20) {
        recommendations.push({
          type: "optimize",
          priority: "high",
          text: `Sequence "${seq.name}" has ${(convRate * 100).toFixed(1)}% conversion rate with ${totalEnrolled} leads. Consider revising the messaging or channel mix.`,
        });
      }

      // Check for steps with high failure rates using pre-fetched data
      for (const step of seq.steps) {
        const stepExecs = execsByStep.get(step.id) ?? [];
        if (stepExecs.length >= 10) {
          const failed = stepExecs.filter(
            (e) => e.status === "FAILED"
          ).length;
          if (failed / stepExecs.length > 0.5) {
            recommendations.push({
              type: "pause",
              priority: "high",
              text: `Step ${step.stepOrder + 1} (${step.channel}) in "${seq.name}" has ${Math.round((failed / stepExecs.length) * 100)}% failure rate. Consider pausing or replacing it.`,
            });
          }
        }
      }
    }

    // Channel comparison recommendation
    const channelMix = await LearningService.getChannelMixAnalysis();
    const multiChannel = channelMix.channelMix.filter(
      (c) => c.channelCount > 1
    );
    const singleChannel = channelMix.channelMix.filter(
      (c) => c.channelCount === 1
    );

    if (multiChannel.length > 0 && singleChannel.length > 0) {
      const bestMulti = multiChannel[0];
      const bestSingle = singleChannel[0];
      if (
        bestMulti.conversionRate > bestSingle.conversionRate &&
        bestMulti.totalEnrolled >= 10
      ) {
        recommendations.push({
          type: "create",
          priority: "medium",
          text: `Multi-channel sequences (${bestMulti.channels}) convert at ${bestMulti.conversionRate}% vs ${bestSingle.conversionRate}% for ${bestSingle.channels}-only. Consider adding more multi-channel sequences.`,
        });
      }
    }

    // Delay optimization
    if (channelMix.delayAnalysis.length >= 2) {
      const best = channelMix.delayAnalysis[0];
      const worst =
        channelMix.delayAnalysis[channelMix.delayAnalysis.length - 1];
      if (
        best.conversionRate > worst.conversionRate * 1.5 &&
        best.totalEnrolled >= 10
      ) {
        recommendations.push({
          type: "optimize",
          priority: "medium",
          text: `${best.delay} delays convert at ${best.conversionRate}% vs ${worst.conversionRate}% for ${worst.delay}. Consider using ${best.delay} delays more often.`,
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    return { recommendations };
  }
}
