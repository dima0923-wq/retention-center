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

type ChannelData = {
  channel: string;
  total: number;
  successful: number;
  successRate: number;
  avgDuration: number | null;
  avgCost: number | null;
};

type ChannelPerformanceChartProps = {
  data: ChannelData[];
};

export function ChannelPerformanceChart({ data }: ChannelPerformanceChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Channel Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="channel" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Legend />
              <Bar
                dataKey="total"
                name="Total Attempts"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="successful"
                name="Successful"
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
