"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Megaphone,
  TrendingUp,
  PhoneCall,
  Mail,
  MailOpen,
  MessageSquareReply,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  Target,
  Percent,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { EmailStats } from "@/types";

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

type EmailActivity = {
  id: string;
  leadName: string;
  channel: string;
  status: string;
  startedAt: string;
};

type ConversionStats = {
  total: number;
  totalRevenue: number;
  conversionRate: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [instantlyConnected, setInstantlyConnected] = useState<boolean | null>(null);
  const [recentEmails, setRecentEmails] = useState<EmailActivity[]>([]);
  const [conversionStats, setConversionStats] = useState<ConversionStats | null>(null);
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

        // Fetch email stats from Instantly analytics
        try {
          const emailRes = await fetch("/api/instantly/analytics");
          if (emailRes.ok) {
            const data = await emailRes.json();
            setEmailStats(data);
            setInstantlyConnected(true);
          } else {
            setInstantlyConnected(false);
          }
        } catch {
          setInstantlyConnected(false);
        }

        // Fetch recent email contact attempts
        try {
          const activityRes = await fetch(
            `/api/contact-attempts?channel=EMAIL&limit=10`
          );
          if (activityRes.ok) {
            const data = await activityRes.json();
            setRecentEmails(Array.isArray(data) ? data : data.data ?? []);
          }
        } catch {
          // silently ignore
        }

        // Fetch conversion stats
        try {
          const convRes = await fetch("/api/conversions/stats");
          if (convRes.ok) {
            setConversionStats(await convRes.json());
          }
        } catch {
          // silently ignore
        }
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

  const emailStatCards = [
    {
      title: "Total Emails Sent",
      value: emailStats?.totalSent ?? 0,
      icon: Mail,
    },
    {
      title: "Open Rate",
      value: `${emailStats?.openRate ?? 0}%`,
      icon: MailOpen,
    },
    {
      title: "Reply Rate",
      value: `${emailStats?.replyRate ?? 0}%`,
      icon: MessageSquareReply,
    },
    {
      title: "Bounce Rate",
      value: `${emailStats?.bounceRate ?? 0}%`,
      icon: AlertTriangle,
    },
  ];

  const conversionCards = [
    {
      title: "Total Conversions",
      value: conversionStats?.total ?? 0,
      icon: Target,
    },
    {
      title: "Revenue",
      value: `$${(conversionStats?.totalRevenue ?? 0).toLocaleString()}`,
      icon: DollarSign,
    },
    {
      title: "Conversion Rate",
      value: `${conversionStats?.conversionRate ?? 0}%`,
      icon: Percent,
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

      {/* Email Stats Section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold">Email Campaign Stats</h2>
          {instantlyConnected !== null && (
            <Badge
              variant={instantlyConnected ? "default" : "destructive"}
              className="flex items-center gap-1"
            >
              {instantlyConnected ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              Instantly {instantlyConnected ? "Connected" : "Disconnected"}
            </Badge>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {emailStatCards.map((stat) => (
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
      </div>

      {/* Conversion Stats Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Conversion Stats</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {conversionCards.map((stat) => (
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

      {/* Recent Email Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Recent Email Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentEmails.length > 0 ? (
            <div className="space-y-3">
              {recentEmails.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{activity.leadName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        activity.status === "SUCCESS"
                          ? "default"
                          : activity.status === "FAILED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {activity.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {activity.startedAt
                        ? format(parseISO(activity.startedAt), "MMM d, HH:mm")
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm text-center py-4">
              {loading ? "Loading..." : "No email activity yet"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
