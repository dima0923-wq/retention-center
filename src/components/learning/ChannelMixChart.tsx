"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type ChannelMixEntry = {
  channels: string;
  channelCount: number;
  sequences: number;
  totalEnrolled: number;
  converted: number;
  conversionRate: number;
};

type DelayEntry = {
  delay: string;
  totalEnrolled: number;
  converted: number;
  conversionRate: number;
};

export function ChannelMixChart() {
  const [channelMix, setChannelMix] = useState<ChannelMixEntry[]>([]);
  const [delayAnalysis, setDelayAnalysis] = useState<DelayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/learning/channel-mix");
        if (res.ok) {
          const data = await res.json();
          setChannelMix(data.channelMix ?? []);
          setDelayAnalysis(data.delayAnalysis ?? []);
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
        Loading channel mix...
      </div>
    );
  }

  if (channelMix.length === 0 && delayAnalysis.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No channel mix data yet. Activate sequences with different channel
        combinations to see comparisons.
      </div>
    );
  }

  const maxRate = Math.max(
    ...channelMix.map((c) => c.conversionRate),
    1
  );
  const maxDelayRate = Math.max(
    ...delayAnalysis.map((d) => d.conversionRate),
    1
  );

  return (
    <div className="space-y-6">
      {/* Channel combinations */}
      {channelMix.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Channel Combinations
          </p>
          {channelMix.map((entry) => (
            <div
              key={entry.channels}
              className="flex items-center gap-3 text-sm"
            >
              <div className="w-36 shrink-0 flex items-center gap-1">
                {entry.channels.split("+").map((ch) => (
                  <Badge
                    key={ch}
                    variant="outline"
                    className="text-xs"
                  >
                    {ch}
                  </Badge>
                ))}
              </div>
              <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(entry.conversionRate / maxRate) * 100}%`,
                    backgroundColor:
                      entry.channelCount > 1
                        ? "var(--primary)"
                        : "hsl(var(--muted-foreground))",
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
                  {entry.conversionRate}%
                </span>
              </div>
              <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
                {entry.converted}/{entry.totalEnrolled} leads
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Delay analysis */}
      {delayAnalysis.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Delay Timing Performance
          </p>
          {delayAnalysis.map((entry) => (
            <div
              key={entry.delay}
              className="flex items-center gap-3 text-sm"
            >
              <span className="w-16 shrink-0 font-medium">
                {entry.delay}
              </span>
              <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{
                    width: `${(entry.conversionRate / maxDelayRate) * 100}%`,
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
                  {entry.conversionRate}%
                </span>
              </div>
              <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
                {entry.converted}/{entry.totalEnrolled} leads
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
