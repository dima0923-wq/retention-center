"use client";

import {
  LineChart,
  Line,
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
import { format, parseISO } from "date-fns";

type TimelineData = {
  date: string;
  leads: number;
  attempts: number;
  conversions: number;
};

type TimelineChartProps = {
  data: TimelineData[];
};

export function TimelineChart({ data }: TimelineChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    dateLabel: format(parseISO(d.date), "MMM d"),
  }));

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="dateLabel" className="text-xs" />
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
              <Line
                type="monotone"
                dataKey="leads"
                name="New Leads"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="attempts"
                name="Attempts"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="conversions"
                name="Conversions"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
