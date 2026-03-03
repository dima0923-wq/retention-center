"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Send, RefreshCw, Loader2, CheckCircle, XCircle, Activity, ExternalLink } from "lucide-react";

type PostbackLog = {
  id: string;
  destination: string;
  subId: string | null;
  status: string;
  httpStatus: number | null;
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
};

const statusBadgeClass: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  retry: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

const destinationLabel: Record<string, string> = {
  traffic_center: "Traffic Center",
  keitaro: "Keitaro",
};

export function OutboundPostbacksCard() {
  const [logs, setLogs] = useState<PostbackLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tcPostbackUrl =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_TRAFFIC_CENTER_URL ?? "https://ag3.q37fh758g.click"
      : "https://ag3.q37fh758g.click";

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch("/api/postback-logs?limit=5"),
        fetch("/api/postback-logs/stats"),
      ]);

      if (logsRes.ok) {
        const json = (await logsRes.json()) as { data: PostbackLog[] };
        setLogs(json.data ?? []);
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const successRate =
    stats && stats.today.total > 0
      ? ((stats.today.success / stats.today.total) * 100).toFixed(1)
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Outbound Postbacks</CardTitle>
              <CardDescription className="text-xs">
                Conversions sent to Traffic Center and Keitaro from retention efforts
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Traffic Center postback URL info */}
        <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Traffic Center Postback Endpoint</p>
          <p className="font-mono text-xs break-all">{tcPostbackUrl}/api/v1/postback</p>
          <p className="text-xs text-muted-foreground">
            Fires with <code className="bg-muted px-1 rounded">source=retention</code> tag on every sale conversion
          </p>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground">Sent Today</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="text-lg font-bold">{stats.today.total}</span>
              </div>
            </div>
            <div className="rounded-md border px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground">Successful</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                <span className="text-lg font-bold">{stats.today.success}</span>
              </div>
              {successRate && (
                <p className="text-xs text-muted-foreground">{successRate}%</p>
              )}
            </div>
            <div className="rounded-md border px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground">Failed</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <XCircle className="h-3 w-3 text-red-500" />
                <span className="text-lg font-bold">{stats.today.failed}</span>
              </div>
            </div>
          </div>
        )}

        {/* Recent postback log */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Recent Outbound Postbacks</p>
            <Link
              href="/postback-logs"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">
              No outbound postbacks yet. They will appear here when sale conversions are processed.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Destination</TableHead>
                  <TableHead className="text-xs">Sub ID</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">HTTP</TableHead>
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
                      })}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-xs capitalize">
                        {destinationLabel[log.destination] ?? log.destination}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.subId
                        ? log.subId.slice(0, 10) + (log.subId.length > 10 ? "…" : "")
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
