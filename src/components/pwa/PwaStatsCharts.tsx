"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PwaFlowStatisticsData } from "@/types/pwaflow";

type PwaStatsChartsProps = {
  statistics: PwaFlowStatisticsData | null;
  loading: boolean;
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  fontSize: "12px",
};

export function PwaStatsCharts({ statistics, loading }: PwaStatsChartsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Events</CardTitle></CardHeader>
          <CardContent><div className="h-64 bg-muted animate-pulse rounded" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Push Stats</CardTitle></CardHeader>
          <CardContent><div className="h-64 bg-muted animate-pulse rounded" /></CardContent>
        </Card>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No statistics data available.
      </div>
    );
  }

  // Build events chart data from events_table
  const eventsData = (statistics.events_table ?? []).map((row) => ({
    name: formatEventKey(row.key ?? ""),
    current: row.unique ?? 0,
    previous: row.unique_previous ?? 0,
  }));

  // Build push chart data from push_table
  const pushData = (statistics.push_table ?? []).map((row) => ({
    name: formatEventKey(row.key ?? ""),
    current: row.unique ?? 0,
    previous: row.unique_previous ?? 0,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {eventsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Events Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="current" name="Current" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previous" name="Previous" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {pushData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Push Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pushData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="current" name="Current" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previous" name="Previous" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {eventsData.length === 0 && pushData.length === 0 && (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          No chart data available for the selected period.
        </div>
      )}
    </div>
  );
}

function formatEventKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
