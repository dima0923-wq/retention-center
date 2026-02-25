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
  DollarSign,
  Target,
  Percent,
  ListOrdered,
  UserCheck,
  Clock,
  Activity,
  Gauge,
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

type SequenceDashboardStats = {
  activeSequences: number;
  totalSequences: number;
  totalEnrolled: number;
  activeEnrollments: number;
  completedEnrollments: number;
  convertedEnrollments: number;
  conversionRate: number;
  upcomingSteps: {
    id: string;
    scheduledAt: string;
    channel: string;
    stepOrder: number;
    leadName: string;
    leadEmail: string | null;
    sequenceName: string;
  }[];
  recentActivity: {
    id: string;
    status: string;
    executedAt: string;
    channel: string;
    stepOrder: number;
    leadName: string;
    sequenceName: string;
  }[];
};

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [recentEmails, setRecentEmails] = useState<EmailActivity[]>([]);
  const [conversionStats, setConversionStats] = useState<ConversionStats | null>(null);
  const [seqStats, setSeqStats] = useState<SequenceDashboardStats | null>(null);
  const [scoreStats, setScoreStats] = useState<{
    total: number;
    distribution: Record<string, number>;
    avgScore: number;
  } | null>(null);
  const [postmarkStats, setPostmarkStats] = useState<{
    Sent: number;
    Opens: number;
    UniqueOpens: number;
    Clicks: number;
    UniqueClicks: number;
    Bounced: number;
    SpamComplaints: number;
  } | null>(null);
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
          }
        } catch {
          // silently ignore
        }

        // Fetch PostMark stats
        try {
          const postmarkRes = await fetch("/api/integrations/postmark/stats", { credentials: "include" });
          if (postmarkRes.ok) {
            const data = await postmarkRes.json();
            if (data?.overview) setPostmarkStats(data.overview);
          }
        } catch {
          // silently ignore
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

        // Fetch sequence dashboard stats
        try {
          const seqRes = await fetch("/api/sequences/dashboard-stats");
          if (seqRes.ok) {
            setSeqStats(await seqRes.json());
          }
        } catch {
          // silently ignore
        }

        // Fetch lead score distribution
        try {
          const scoreRes = await fetch("/api/leads/scoring");
          if (scoreRes.ok) {
            setScoreStats(await scoreRes.json());
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

  const instantlySent = emailStats?.totalSent ?? 0;
  const postmarkSent = postmarkStats?.Sent ?? 0;
  const totalEmailsSent = instantlySent + postmarkSent;

  const postmarkOpenRate = postmarkSent > 0
    ? Number(((postmarkStats!.UniqueOpens / postmarkSent) * 100).toFixed(1))
    : 0;
  const postmarkBounceRate = postmarkSent > 0
    ? Number(((postmarkStats!.Bounced / postmarkSent) * 100).toFixed(1))
    : 0;

  const emailStatCards = [
    {
      title: "Total Emails Sent",
      value: totalEmailsSent,
      subtitle: postmarkSent > 0 ? `Instantly: ${instantlySent} · PostMark: ${postmarkSent}` : undefined,
      icon: Mail,
    },
    {
      title: "Open Rate",
      value: postmarkSent > 0
        ? `Inst: ${emailStats?.openRate ?? 0}% / PM: ${postmarkOpenRate}%`
        : `${emailStats?.openRate ?? 0}%`,
      icon: MailOpen,
    },
    {
      title: "Reply Rate",
      value: `${emailStats?.replyRate ?? 0}%`,
      subtitle: "Instantly only",
      icon: MessageSquareReply,
    },
    {
      title: "Bounce Rate",
      value: postmarkSent > 0
        ? `Inst: ${emailStats?.bounceRate ?? 0}% / PM: ${postmarkBounceRate}%`
        : `${emailStats?.bounceRate ?? 0}%`,
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

  const sequenceCards = [
    {
      title: "Active Sequences",
      value: seqStats?.activeSequences ?? 0,
      icon: ListOrdered,
    },
    {
      title: "Enrolled Leads",
      value: seqStats?.activeEnrollments ?? 0,
      icon: UserCheck,
    },
    {
      title: "Seq. Conversion Rate",
      value: `${seqStats?.conversionRate ?? 0}%`,
      icon: TrendingUp,
    },
    {
      title: "Total Completed",
      value: seqStats?.completedEnrollments ?? 0,
      icon: CheckCircle2,
    },
  ];

  const channelBadgeColor = (channel: string) => {
    switch (channel) {
      case "EMAIL":
        return "default";
      case "SMS":
        return "secondary";
      case "CALL":
        return "outline";
      default:
        return "secondary";
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "SENT":
      case "DELIVERED":
        return "default" as const;
      case "FAILED":
        return "destructive" as const;
      case "SKIPPED":
        return "secondary" as const;
      default:
        return "secondary" as const;
    }
  };

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

      {/* Lead Score Distribution */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Lead Score Distribution</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Score
              </CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : scoreStats?.avgScore ?? 0}
              </div>
            </CardContent>
          </Card>
          {[
            { key: "HOT", label: "Hot", className: "text-red-600" },
            { key: "WARM", label: "Warm", className: "text-yellow-600" },
            { key: "COLD", label: "Cold", className: "text-blue-600" },
            { key: "DEAD", label: "Dead", className: "text-gray-500" },
            { key: "NEW", label: "New", className: "text-green-600" },
          ].map((item) => (
            <Card key={item.key}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className={`text-sm font-medium ${item.className}`}>
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : scoreStats?.distribution?.[item.key] ?? 0}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Sequence Stats Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Retention Sequences</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sequenceCards.map((stat) => (
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

      {/* Upcoming Sequence Steps + Recent Sequence Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming Steps */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">
              Upcoming Sequence Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            {seqStats && seqStats.upcomingSteps.length > 0 ? (
              <div className="space-y-3">
                {seqStats.upcomingSteps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={channelBadgeColor(step.channel)}>
                        {step.channel}
                      </Badge>
                      <span className="font-medium truncate">
                        {step.leadName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground text-xs truncate max-w-[120px]">
                        {step.sequenceName}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {step.scheduledAt
                          ? format(parseISO(step.scheduledAt), "MMM d, HH:mm")
                          : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm text-center py-4">
                {loading ? "Loading..." : "No upcoming steps"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sequence Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">
              Recent Sequence Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {seqStats && seqStats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {seqStats.recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={channelBadgeColor(item.channel)}>
                        {item.channel}
                      </Badge>
                      <span className="font-medium truncate">
                        {item.leadName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusBadgeVariant(item.status)}>
                        {item.status}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {item.executedAt
                          ? format(parseISO(item.executedAt), "MMM d, HH:mm")
                          : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm text-center py-4">
                {loading ? "Loading..." : "No sequence activity yet"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email Stats Section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold">Email Campaign Stats</h2>
          {postmarkStats && (
            <Badge variant="outline" className="text-xs">Instantly + PostMark</Badge>
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
                {"subtitle" in stat && stat.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                )}
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
