"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  MessageSquare,
  Mail,
  Phone,
  type LucideIcon,
} from "lucide-react";

type Insight = {
  id: string;
  text: string;
  metric?: string;
  type: "positive" | "negative" | "neutral";
  channel?: string;
  category?: string;
};

type InsightCardProps = {
  insight: Insight;
};

const channelIcons: Record<string, LucideIcon> = {
  SMS: MessageSquare,
  EMAIL: Mail,
  CALL: Phone,
};

const categoryIcons: Record<string, LucideIcon> = {
  timing: Clock,
  word: MessageSquare,
  channel: TrendingUp,
};

export function InsightCard({ insight }: InsightCardProps) {
  const Icon =
    insight.type === "positive"
      ? TrendingUp
      : insight.type === "negative"
        ? TrendingDown
        : channelIcons[insight.channel ?? ""] ??
          categoryIcons[insight.category ?? ""] ??
          TrendingUp;

  return (
    <Card
      className={
        insight.type === "positive"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : insight.type === "negative"
            ? "border-red-500/30 bg-red-500/5"
            : ""
      }
    >
      <CardContent className="flex items-start gap-3 pt-4">
        <div
          className={`mt-0.5 rounded-md p-1.5 ${
            insight.type === "positive"
              ? "bg-emerald-500/10 text-emerald-500"
              : insight.type === "negative"
                ? "bg-red-500/10 text-red-500"
                : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">{insight.text}</p>
          <div className="flex items-center gap-2 mt-2">
            {insight.metric && (
              <Badge variant="secondary" className="text-xs">
                {insight.metric}
              </Badge>
            )}
            {insight.channel && (
              <Badge variant="outline" className="text-xs">
                {insight.channel}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
