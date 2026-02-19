"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

type ABTestStats = {
  attempts: number;
  conversions: number;
  conversionRate: number;
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

type ABTestCardProps = {
  test: ABTest;
};

function parseStats(json: string): ABTestStats {
  try {
    return JSON.parse(json);
  } catch {
    return { attempts: 0, conversions: 0, conversionRate: 0 };
  }
}

export function ABTestCard({ test }: ABTestCardProps) {
  const statsA = parseStats(test.statsA);
  const statsB = parseStats(test.statsB);
  const isComplete = test.status === "COMPLETED";
  const totalA = statsA.attempts;
  const totalB = statsB.attempts;
  const total = totalA + totalB;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          {test.channel} Test
        </CardTitle>
        <Badge
          variant={
            isComplete
              ? "default"
              : test.status === "RUNNING"
                ? "secondary"
                : "outline"
          }
        >
          {test.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Variant A */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">A:</span>
              <span className="text-muted-foreground truncate max-w-[200px]">
                {test.variantA}
              </span>
              {test.winnerId === test.variantA && (
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
              )}
            </div>
            <span className="text-sm font-medium">
              {statsA.conversionRate.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{
                width: `${total > 0 ? (totalA / total) * 100 : 50}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {statsA.conversions} / {statsA.attempts} conversions
          </p>
        </div>

        {/* Variant B */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">B:</span>
              <span className="text-muted-foreground truncate max-w-[200px]">
                {test.variantB}
              </span>
              {test.winnerId === test.variantB && (
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
              )}
            </div>
            <span className="text-sm font-medium">
              {statsB.conversionRate.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all"
              style={{
                width: `${total > 0 ? (totalB / total) * 100 : 50}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {statsB.conversions} / {statsB.attempts} conversions
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
