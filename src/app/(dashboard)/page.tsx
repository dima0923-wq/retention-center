"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Megaphone, TrendingUp, PhoneCall } from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { format, parseISO } from "date-fns";

type OverviewStats = {
  totalLeads: number;
  activeCampaigns: number;
  conversionRate: number;
  totalAttempts: number;
};

type TimelineData = {
  date: string;
  leads: number;
  attempts: number;
  conversions: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const from = new Date();
        from.setDate(from.getDate() - 7);
        const params = `from=${from.toISOString()}&to=${new Date().toISOString()}`;

        const [overviewRes, timelineRes] = await Promise.all([
          fetch(`/api/reports/overview?${params}`),
          fetch(`/api/reports/timeline?${params}`),
        ]);

        if (overviewRes.ok) setStats(await overviewRes.json());
        if (timelineRes.ok) setTimeline(await timelineRes.json());
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const statCards = [
    {
      title: "Total Leads",
      value: stats?.totalLeads ?? 0,
      icon: Users,
    },
    {
      title: "Active Campaigns",
      value: stats?.activeCampaigns ?? 0,
      icon: Megaphone,
    },
    {
      title: "Conversion Rate",
      value: `${stats?.conversionRate ?? 0}%`,
      icon: TrendingUp,
    },
    {
      title: "Contact Attempts",
      value: stats?.totalAttempts ?? 0,
      icon: PhoneCall,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Leads Trend (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={timeline.map((d) => ({
                      ...d,
                      label: format(parseISO(d.date), "MMM d"),
                    }))}
                  >
                    <XAxis dataKey="label" className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="leads"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {loading ? "Loading..." : "No data yet"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Contact Activity (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={timeline.map((d) => ({
                      ...d,
                      label: format(parseISO(d.date), "MMM d"),
                    }))}
                  >
                    <XAxis dataKey="label" className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="attempts"
                      name="Attempts"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {loading ? "Loading..." : "No data yet"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
