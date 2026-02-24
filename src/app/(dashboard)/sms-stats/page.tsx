"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  TrendingUp,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

type SmsStats = {
  totalSent: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  avgCost: number;
  totalCost: number;
  smsByDay: { date: string; count: number }[];
  smsByStatus: { status: string; count: number }[];
  smsByCampaign: { campaignId: string; campaignName: string; count: number }[];
  timeline: { date: string; sent: number; delivered: number; failed: number }[];
};

type RecentSms = {
  id: string;
  leadName: string;
  phone: string;
  campaign: string | null;
  status: string;
  date: string;
  cost: number | null;
  result: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

const PIE_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"];

export default function SmsStatsPage() {
  const [stats, setStats] = useState<SmsStats | null>(null);
  const [recent, setRecent] = useState<RecentSms[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, recentRes] = await Promise.all([
        fetch("/api/sms-stats"),
        fetch(`/api/sms-stats/recent?page=${page}&limit=20`),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (recentRes.ok) {
        const json = await recentRes.json();
        setRecent(json.data ?? []);
        setPagination(json.pagination ?? null);
      }
    } catch (err) {
      console.error("Failed to fetch SMS stats:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">SMS Stats</h2>
        <p className="text-muted-foreground mt-1">
          SMS delivery analytics and performance metrics.
        </p>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading SMS stats...</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalSent ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Delivered</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.delivered ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.failed ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(stats?.deliveryRate ?? 0).toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${(stats?.totalCost ?? 0).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Avg ${(stats?.avgCost ?? 0).toFixed(3)}/sms
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* SMS Over Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">SMS Sent (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.timeline && stats.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.timeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="sent"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                        name="Sent"
                      />
                      <Line
                        type="monotone"
                        dataKey="delivered"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        name="Delivered"
                      />
                      <Line
                        type="monotone"
                        dataKey="failed"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        name="Failed"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No data yet</p>
                )}
              </CardContent>
            </Card>

            {/* SMS By Status (Donut) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">SMS by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.smsByStatus && stats.smsByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={stats.smsByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="count"
                        nameKey="status"
                        label={((props: { name?: string; value?: number }) => `${props.name ?? ""}: ${props.value ?? 0}`) as never}
                      >
                        {stats.smsByStatus.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No data yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Campaigns */}
          {stats?.smsByCampaign && stats.smsByCampaign.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top Campaigns by SMS Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, stats.smsByCampaign.length * 40)}>
                  <BarChart data={stats.smsByCampaign} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="campaignName"
                      tick={{ fontSize: 11 }}
                      width={150}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" name="SMS Count" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Recent SMS Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Recent SMS</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No SMS records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    recent.map((sms) => (
                      <TableRow key={sms.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(sms.date).toLocaleDateString()}{" "}
                          {new Date(sms.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell className="text-sm">{sms.leadName || "-"}</TableCell>
                        <TableCell className="text-xs font-mono">{sms.phone || "-"}</TableCell>
                        <TableCell className="text-xs">{sms.campaign ?? "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={STATUS_COLORS[sms.status] ?? ""}
                          >
                            {sms.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {sms.cost != null ? `$${sms.cost.toFixed(3)}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
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
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
