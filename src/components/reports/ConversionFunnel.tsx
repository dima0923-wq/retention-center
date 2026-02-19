"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type FunnelData = {
  status: string;
  count: number;
};

type ConversionFunnelProps = {
  data: FunnelData[];
};

const statusLabels: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  IN_PROGRESS: "In Progress",
  CONVERTED: "Converted",
};

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: statusLabels[d.status] ?? d.status,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" className="text-xs" />
              <YAxis
                dataKey="label"
                type="category"
                width={90}
                className="text-xs"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--chart-1))"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
