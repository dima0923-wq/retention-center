"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  DollarSign,
  Percent,
  Trophy,
  MessageSquare,
  Mail,
  Phone,
  Lightbulb,
  FlaskConical,
} from "lucide-react";
import { StatsCard } from "@/components/reports/StatsCard";
import { WordPerformance } from "@/components/learning/WordPerformance";
import { InsightCard } from "@/components/learning/InsightCard";
import { ConversionHeatmap } from "@/components/learning/ConversionHeatmap";
import { ABTestCard } from "@/components/learning/ABTestCard";

type ConversionStats = {
  totalConversions: number;
  totalRevenue: number;
  conversionRate: number;
  bestChannel: string;
};

type FunnelStage = {
  stage: string;
  count: number;
};

type Insight = {
  id: string;
  text: string;
  metric?: string;
  type: "positive" | "negative" | "neutral";
  channel?: string;
  category?: string;
};

type ABTest = {
  id: string;
  campaignId: string;
  channel: string;
  variantA: string;
  variantB: string;
  status: string;
  winnerId: string | null;
  startedAt: string;
  endedAt: string | null;
  statsA: string;
  statsB: string;
};

type Suggestion = {
  id: string;
  campaignId: string;
  channel: string;
  includeWords: string[];
  avoidWords: string[];
  optimalTime: string;
  templateStructure: string;
};

const CHANNELS = [
  { key: "SMS", label: "SMS", icon: MessageSquare },
  { key: "CALL", label: "Call", icon: Phone },
  { key: "EMAIL", label: "Email", icon: Mail },
];

export default function LearningPage() {
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [abTests, setAbTests] = useState<ABTest[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeChannel, setActiveChannel] = useState("SMS");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, funnelRes, insightsRes, abTestsRes, suggestionsRes] =
        await Promise.all([
          fetch("/api/conversions/stats"),
          fetch("/api/learning/funnel"),
          fetch("/api/learning/insights"),
          fetch("/api/learning/ab-tests"),
          fetch("/api/learning/suggestions"),
        ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (funnelRes.ok) {
        const data = await funnelRes.json();
        setFunnel(Array.isArray(data) ? data : data.stages ?? []);
      }
      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setInsights(Array.isArray(data) ? data : data.insights ?? []);
      }
      if (abTestsRes.ok) {
        const data = await abTestsRes.json();
        setAbTests(Array.isArray(data) ? data : data.tests ?? []);
      }
      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json();
        setSuggestions(Array.isArray(data) ? data : data.suggestions ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch learning data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeTests = abTests.filter((t) => t.status === "RUNNING");
  const completedTests = abTests.filter((t) => t.status === "COMPLETED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Self-Learning Dashboard
        </h2>
        <p className="text-muted-foreground mt-1">
          AI-powered conversion optimization and performance insights.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading learning data...</p>
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Conversions"
              value={stats?.totalConversions ?? 0}
              icon={Target}
            />
            <StatsCard
              title="Revenue"
              value={`$${(stats?.totalRevenue ?? 0).toLocaleString()}`}
              icon={DollarSign}
            />
            <StatsCard
              title="Avg Conv Rate"
              value={`${(stats?.conversionRate ?? 0).toFixed(1)}%`}
              icon={Percent}
            />
            <StatsCard
              title="Best Channel"
              value={stats?.bestChannel ?? "N/A"}
              icon={Trophy}
            />
          </div>

          {/* Word Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Word Performance by Channel
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Channel tabs */}
              <div className="flex gap-1 mb-4 border-b pb-2">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.key}
                    onClick={() => setActiveChannel(ch.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeChannel === ch.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ch.icon className="h-3.5 w-3.5" />
                    {ch.label}
                  </button>
                ))}
              </div>
              <WordPerformance channel={activeChannel} />
            </CardContent>
          </Card>

          {/* Insights */}
          {insights.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold">Auto-Generated Insights</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </div>
          )}

          {/* Conversion Funnel + Heatmap row */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Conversion Funnel
                </CardTitle>
              </CardHeader>
              <CardContent>
                {funnel.length === 0 ? (
                  <div className="text-muted-foreground text-sm text-center py-8">
                    No funnel data yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {funnel.map((stage, i) => {
                      const maxCount = funnel[0]?.count ?? 1;
                      const pct =
                        maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
                      return (
                        <div key={stage.stage} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{stage.stage}</span>
                            <span className="text-muted-foreground">
                              {stage.count.toLocaleString()}
                              {i > 0 && funnel[i - 1].count > 0 && (
                                <span className="ml-1 text-xs">
                                  ({((stage.count / funnel[i - 1].count) * 100).toFixed(0)}%)
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Heatmap */}
            <ConversionHeatmap />
          </div>

          {/* A/B Tests */}
          {abTests.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical className="h-4 w-4 text-violet-500" />
                <h3 className="text-sm font-semibold">A/B Tests</h3>
              </div>

              {activeTests.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
                    Active
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {activeTests.map((test) => (
                      <ABTestCard key={test.id} test={test} />
                    ))}
                  </div>
                </div>
              )}

              {completedTests.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
                    Completed
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {completedTests.map((test) => (
                      <ABTestCard key={test.id} test={test} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Script Suggestions */}
          {suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Script Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-md border p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{s.channel}</Badge>
                        {s.optimalTime && (
                          <span className="text-xs text-muted-foreground">
                            Best time: {s.optimalTime}
                          </span>
                        )}
                      </div>
                      {s.includeWords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-emerald-500 font-medium mr-1">
                            Include:
                          </span>
                          {s.includeWords.map((w) => (
                            <Badge
                              key={w}
                              variant="secondary"
                              className="text-xs bg-emerald-500/10 text-emerald-600"
                            >
                              {w}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {s.avoidWords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-red-500 font-medium mr-1">
                            Avoid:
                          </span>
                          {s.avoidWords.map((w) => (
                            <Badge
                              key={w}
                              variant="secondary"
                              className="text-xs bg-red-500/10 text-red-600"
                            >
                              {w}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {s.templateStructure && (
                        <p className="text-xs text-muted-foreground">
                          {s.templateStructure}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
