"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type WordData = {
  word: string;
  conversionRate: number;
  attempts: number;
  conversions: number;
  confidence: number;
};

type WordPerformanceProps = {
  channel: string;
};

export function WordPerformance({ channel }: WordPerformanceProps) {
  const [words, setWords] = useState<WordData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWords() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/learning/words?channel=${channel}&limit=20`
        );
        if (res.ok) {
          const data = await res.json();
          setWords(Array.isArray(data) ? data : data.words ?? []);
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    }
    fetchWords();
  }, [channel]);

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        Loading word performance...
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No word performance data yet for {channel}. Start running campaigns to
        see which words convert best.
      </div>
    );
  }

  const maxRate = Math.max(...words.map((w) => w.conversionRate), 1);

  return (
    <div className="space-y-2">
      {words.map((word) => (
        <div
          key={word.word}
          className="flex items-center gap-3 rounded-md border px-3 py-2"
        >
          <span className="text-sm font-medium w-32 truncate">
            {word.word}
          </span>
          <div className="flex-1 relative h-5 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary/80 rounded-full transition-all"
              style={{
                width: `${(word.conversionRate / maxRate) * 100}%`,
              }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
              {word.conversionRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">
              {word.conversions}/{word.attempts}
            </span>
            <Badge
              variant={
                word.confidence >= 0.8
                  ? "default"
                  : word.confidence >= 0.5
                    ? "secondary"
                    : "outline"
              }
              className="text-xs"
            >
              {word.confidence >= 0.8
                ? "High"
                : word.confidence >= 0.5
                  ? "Med"
                  : "Low"}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
