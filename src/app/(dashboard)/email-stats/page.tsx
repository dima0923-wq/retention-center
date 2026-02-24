"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Mail,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  MousePointerClick,
  MessageSquareReply,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { StatsCard } from "@/components/reports/StatsCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type EmailStats = {
  totalSent: number;
  delivered: number;
  failed: number;
  bounced: number;
  pending: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  emailsByDay: { date: string; count: number }[];
  emailsByStatus: Record<string, number>;
  emailsByCampaign: { campaignId: string; name: string; count: number }[];
  postmarkStats: Record<string, unknown> | null;
  instantlyStats: {
    totalSent: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
  } | null;
};

type RecentEmail = {
  id: string;
  status: string;
  provider: string | null;
  startedAt: string;
  completedAt: string | null;
  result: string | null;
  cost: number | null;
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  campaignId: string | null;
  campaignName: string | null;
  templateName: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  FAILED: "bg-red-100 text-red-800",
  BOUNCED: "bg-orange-100 text-orange-800",
};

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  fontSize: "12px",
};

export default function EmailStatsPage() {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [recent, setRecent] = useState<RecentEmail[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [providerOpen, setProviderOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/email-stats");
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error("Failed to fetch email stats:", err);
    }
  }, []);

  const fetchRecent = useCallback(async (p: number) => {
    try {
      const res = await fetch(`/api/email-stats/recent?page=${p}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setRecent(data.items);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch recent emails:", err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchRecent(1)]).finally(() => setLoading(false));
  }, [fetchStats, fetchRecent]);

  useEffect(() => {
    fetchRecent(page);
  }, [page, fetchRecent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading email stats...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Failed to load email stats.</p>
      </div>
    );
  }

  // Prepare chart data
  const timelineData = stats.emailsByDay.map((d) => ({
    ...d,
    dateLabel: format(parseISO(d.date), "MMM d"),
  }));

  const statusData = Object.entries(stats.emailsByStatus).map(([status, count]) => ({
    name: status,
    value: count,
  }));

  const funnelData = [
    { name: "Sent", value: stats.totalSent },
    { name: "Delivered", value: stats.delivered },
    { name: "Opened", value: stats.totalSent > 0 ? Math.round(stats.totalSent * stats.openRate / 100) : 0 },
    { name: "Clicked", value: stats.totalSent > 0 ? Math.round(stats.totalSent * stats.clickRate / 100) : 0 },
    { name: "Replied", value: stats.totalSent > 0 ? Math.round(stats.totalSent * stats.replyRate / 100) : 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email Stats</h2>
        <p className="text-muted-foreground mt-1">
          Email delivery and engagement analytics (last 30 days).
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatsCard title="Total Sent" value={stats.totalSent} icon={Mail} />
        <StatsCard title="Delivered" value={stats.delivered} icon={CheckCircle} />
        <StatsCard title="Bounced" value={stats.bounced} icon={AlertTriangle} />
        <StatsCard title="Open Rate" value={`${stats.openRate}%`} icon={Eye} />
        <StatsCard title="Click Rate" value={`${stats.clickRate}%`} icon={MousePointerClick} />
        <StatsCard title="Reply Rate" value={`${stats.replyRate}%`} icon={MessageSquareReply} />
      </div>

      {/* Charts Row 1: Timeline + Delivery Funnel */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Emails Sent Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="dateLabel" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Emails Sent"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Delivery Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={70} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Status Pie + Top Campaigns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Emails by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Campaigns by Email Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {stats.emailsByCampaign.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No campaign data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.emailsByCampaign} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" className="text-xs" width={120} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Emails" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Stats (collapsible) */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setProviderOpen(!providerOpen)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Provider Stats</CardTitle>
            {providerOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {providerOpen && (
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Postmark */}
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-3">Postmark</h4>
                {stats.postmarkStats ? (
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(stats.postmarkStats).map(([key, val]) => (
                      <div key={key}>
                        <dt className="text-muted-foreground">{key}</dt>
                        <dd className="font-medium">{String(val)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">Not configured</p>
                )}
              </div>

              {/* Instantly */}
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-3">Instantly</h4>
                {stats.instantlyStats ? (
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Total Sent</dt>
                      <dd className="font-medium">{stats.instantlyStats.totalSent}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Open Rate</dt>
                      <dd className="font-medium">{stats.instantlyStats.openRate}%</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Click Rate</dt>
                      <dd className="font-medium">{stats.instantlyStats.clickRate}%</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Reply Rate</dt>
                      <dd className="font-medium">{stats.instantlyStats.replyRate}%</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Bounce Rate</dt>
                      <dd className="font-medium">{stats.instantlyStats.bounceRate}%</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">Not configured</p>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Recent Emails Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Emails</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No email attempts found
                  </TableCell>
                </TableRow>
              ) : (
                recent.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(parseISO(email.startedAt), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">{email.leadName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {email.leadEmail ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {email.campaignName ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {email.templateName ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={STATUS_COLORS[email.status] ?? ""}
                      >
                        {email.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
