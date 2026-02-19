"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Pause,
  Plus,
  Settings,
} from "lucide-react";

type Recommendation = {
  type: "create" | "pause" | "optimize";
  priority: "high" | "medium" | "low";
  text: string;
};

const typeConfig = {
  create: { icon: Plus, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  pause: { icon: Pause, color: "text-red-500", bg: "bg-red-500/10" },
  optimize: { icon: Settings, color: "text-amber-500", bg: "bg-amber-500/10" },
};

const priorityVariant: Record<string, "default" | "secondary" | "outline"> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

export function RecommendedActions() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/learning/recommendations");
        if (res.ok) {
          const data = await res.json();
          setRecommendations(data.recommendations ?? []);
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
        Analyzing sequences...
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No recommendations yet. Activate sequences and enroll leads to receive
        optimization suggestions.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recommendations.map((rec, i) => {
        const config = typeConfig[rec.type];
        const Icon = config.icon;

        return (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border p-3"
          >
            <div
              className={`mt-0.5 rounded-md p-1.5 ${config.bg} ${config.color}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{rec.text}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge
                  variant={priorityVariant[rec.priority]}
                  className="text-xs"
                >
                  {rec.priority}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {rec.type}
                </Badge>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
