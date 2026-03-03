"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Send,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

type PostbackLog = {
  id: string;
  leadId: string | null;
  conversionId: string | null;
  destination: string;
  url: string;
  subId: string | null;
  status: string;
  httpStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
};

type Stats = {
  today: {
    total: number;
    success: number;
    failed: number;
    retry: number;
  };
  byDestination: { destination: string; count: number }[];
  byStatus: { status: string; count: number }[];
};

const DESTINATIONS = ["traffic_center", "keitaro"];
const STATUSES = ["success", "failed", "retry"];
const PAGE_SIZE = 50;

const statusBadgeClass: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  retry: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

const destinationLabel: Record<string, string> = {
  traffic_center: "Traffic Center",
  keitaro: "Keitaro",
};

export default function PostbackLogsPage() {
  const [logs, setLogs] = useState<PostbackLog[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [destinationFilter, setDestinationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchLogs = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("skip", String((page - 1) * PAGE_SIZE));
        if (destinationFilter !== "all") params.set("destination", destinationFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);

        const [logsRes, statsRes] = await Promise.all([
          fetch(`/api/postback-logs?${params.toString()}`),
          fetch("/api/postback-logs/stats"),
        ]);

        if (logsRes.ok) {
          const json = (await logsRes.json()) as { data: PostbackLog[]; total: number };
          setLogs(json.data ?? []);
          setTotal(json.total ?? 0);
        }
        if (statsRes.ok) {
          const statsJson = (await statsRes.json()) as Stats;
          setStats(statsJson);
        }
      } catch (err) {
        console.error("Failed to fetch postback logs:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, destinationFilter, statusFilter]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [destinationFilter, statusFilter]);

  const handleRetry = async (log: PostbackLog) => {
    setRetryingId(log.id);
    try {
      const res = await fetch(`/api/postback-logs/${log.id}/retry`, { method: "POST" });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (res.ok) {
        toast[data.success ? "success" : "error"](
          data.success ? "Retry succeeded" : "Retry failed again"
        );
        fetchLogs(true);
      } else {
        toast.error(data.error ?? "Retry failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setRetryingId(null);
    }
  };

  const successRate =
    stats && stats.today.total > 0
      ? ((stats.today.success / stats.today.total) * 100).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Postback Logs</h2>
          <p className="text-muted-foreground mt-1">
            Outbound postbacks sent to Traffic Center and Keitaro.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent Today</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today.success}</div>
              {successRate && (
                <p className="text-xs text-muted-foreground">{successRate}% success rate</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today.failed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retried</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today.retry}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Destination</label>
              <Select value={destinationFilter} onValueChange={setDestinationFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All destinations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All destinations</SelectItem>
                  {DESTINATIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {destinationLabel[d] ?? d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(destinationFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDestinationFilter("all");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {total > 0 ? `${total} postback${total !== 1 ? "s" : ""}` : "Postback Log"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <Send className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No postback logs found.</p>
              <p className="text-xs text-muted-foreground">
                Outbound postbacks will appear here when conversions are sent.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Timestamp</TableHead>
                    <TableHead className="text-xs">Destination</TableHead>
                    <TableHead className="text-xs">Sub ID</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">HTTP</TableHead>
                    <TableHead className="text-xs">Retries</TableHead>
                    <TableHead className="text-xs">Error</TableHead>
                    <TableHead className="text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString()}{" "}
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="capitalize text-xs">
                          {destinationLabel[log.destination] ?? log.destination}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.subId
                          ? log.subId.slice(0, 14) + (log.subId.length > 14 ? "…" : "")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-xs capitalize ${statusBadgeClass[log.status] ?? ""}`}
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {log.httpStatus ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        {log.retryCount > 0 ? (
                          <Badge variant="outline" className="text-xs">
                            {log.retryCount}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.errorMessage ?? "-"}
                      </TableCell>
                      <TableCell>
                        {log.status !== "success" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRetry(log)}
                            disabled={retryingId === log.id}
                            title="Retry postback"
                          >
                            <RotateCcw
                              className={`h-3.5 w-3.5 ${retryingId === log.id ? "animate-spin" : ""}`}
                            />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} total)
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
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
