"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type HeatmapCell = {
  day: number;
  hour: number;
  conversions: number;
  attempts: number;
  rate: number;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getColor(rate: number, maxRate: number): string {
  if (maxRate === 0 || rate === 0) return "bg-muted";
  const intensity = rate / maxRate;
  if (intensity > 0.75) return "bg-emerald-500";
  if (intensity > 0.5) return "bg-emerald-400";
  if (intensity > 0.25) return "bg-emerald-300";
  return "bg-emerald-200";
}

export function ConversionHeatmap() {
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHeatmap() {
      try {
        const res = await fetch("/api/learning/heatmap");
        if (res.ok) {
          const data = await res.json();
          setCells(Array.isArray(data) ? data : data.cells ?? []);
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    }
    fetchHeatmap();
  }, []);

  const cellMap = new Map<string, HeatmapCell>();
  cells.forEach((c) => cellMap.set(`${c.day}-${c.hour}`, c));
  const maxRate = Math.max(...cells.map((c) => c.rate), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Best Contact Times
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-muted-foreground text-sm text-center py-8">
            Loading heatmap...
          </div>
        ) : cells.length === 0 ? (
          <div className="text-muted-foreground text-sm text-center py-8">
            No timing data yet. Run campaigns to discover optimal contact times.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex items-center gap-px ml-10 mb-1">
                {HOURS.filter((h) => h % 3 === 0).map((h) => (
                  <span
                    key={h}
                    className="text-[10px] text-muted-foreground"
                    style={{ width: `${(3 / 24) * 100}%` }}
                  >
                    {h.toString().padStart(2, "0")}
                  </span>
                ))}
              </div>
              {/* Grid */}
              {DAYS.map((day, di) => (
                <div key={day} className="flex items-center gap-px mb-px">
                  <span className="text-xs text-muted-foreground w-10 shrink-0">
                    {day}
                  </span>
                  {HOURS.map((h) => {
                    const cell = cellMap.get(`${di}-${h}`);
                    return (
                      <div
                        key={h}
                        className={`flex-1 h-5 rounded-sm ${getColor(
                          cell?.rate ?? 0,
                          maxRate
                        )} transition-colors`}
                        title={
                          cell
                            ? `${day} ${h}:00 — ${cell.rate.toFixed(1)}% (${cell.conversions}/${cell.attempts})`
                            : `${day} ${h}:00 — No data`
                        }
                      />
                    );
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 ml-10">
                <span className="text-[10px] text-muted-foreground">Low</span>
                <div className="flex gap-px">
                  <div className="w-4 h-3 rounded-sm bg-emerald-200" />
                  <div className="w-4 h-3 rounded-sm bg-emerald-300" />
                  <div className="w-4 h-3 rounded-sm bg-emerald-400" />
                  <div className="w-4 h-3 rounded-sm bg-emerald-500" />
                </div>
                <span className="text-[10px] text-muted-foreground">High</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
