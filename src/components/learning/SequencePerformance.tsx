"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type StepStat = {
  stepOrder: number;
  channel: string;
  delayValue: number;
  delayUnit: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  dropOffRate: number;
};

type SequenceStat = {
  id: string;
  name: string;
  status: string;
  channels: string[];
  totalEnrolled: number;
  converted: number;
  completed: number;
  active: number;
  conversionRate: number;
  steps: StepStat[];
};

export function SequencePerformance() {
  const [sequences, setSequences] = useState<SequenceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/learning/sequence-performance");
        if (res.ok) {
          const data = await res.json();
          setSequences(data.sequences ?? []);
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        Loading sequence performance...
      </div>
    );
  }

  if (sequences.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No sequence data yet. Create and activate sequences to see performance analytics.
      </div>
    );
  }

  const maxRate = Math.max(...sequences.map((s) => s.conversionRate), 1);

  return (
    <div className="space-y-3">
      {sequences.map((seq, i) => (
        <div
          key={seq.id}
          className="rounded-lg border overflow-hidden"
        >
          <button
            onClick={() =>
              setExpandedId(expandedId === seq.id ? null : seq.id)
            }
            className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
          >
            <span className="text-sm font-medium text-muted-foreground w-6">
              #{i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {seq.name}
                </span>
                <Badge
                  variant={
                    seq.status === "ACTIVE" ? "default" : "secondary"
                  }
                  className="text-xs shrink-0"
                >
                  {seq.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{seq.totalEnrolled} enrolled</span>
                <span>{seq.converted} converted</span>
                <span>{seq.active} active</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{
                    width: `${(seq.conversionRate / maxRate) * 100}%`,
                  }}
                />
              </div>
              <span className="text-sm font-bold w-14 text-right">
                {seq.conversionRate}%
              </span>
            </div>
          </button>

          {expandedId === seq.id && seq.steps.length > 0 && (
            <div className="border-t bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Step Drop-off Analysis
              </p>
              {seq.steps.map((step) => (
                <div
                  key={step.stepOrder}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-20 shrink-0 text-muted-foreground">
                    Step {step.stepOrder + 1}
                  </span>
                  <Badge variant="outline" className="text-xs w-16 justify-center">
                    {step.channel}
                  </Badge>
                  <span className="text-xs text-muted-foreground w-16 shrink-0">
                    {step.delayValue > 0
                      ? `+${step.delayValue}${step.delayUnit.charAt(0).toLowerCase()}`
                      : "Immediate"}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${100 - step.dropOffRate}%`,
                        backgroundColor:
                          step.dropOffRate > 30
                            ? "var(--destructive)"
                            : step.dropOffRate > 15
                              ? "var(--warning, #f59e0b)"
                              : "var(--primary)",
                      }}
                    />
                  </div>
                  <span className="text-xs w-24 text-right shrink-0">
                    {step.sent} sent / {step.failed} failed
                  </span>
                  {step.dropOffRate > 0 && (
                    <span
                      className={`text-xs font-medium w-16 text-right ${
                        step.dropOffRate > 30
                          ? "text-red-500"
                          : step.dropOffRate > 15
                            ? "text-amber-500"
                            : "text-muted-foreground"
                      }`}
                    >
                      -{step.dropOffRate}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
