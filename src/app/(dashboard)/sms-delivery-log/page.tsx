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
import { Input } from "@/components/ui/input";
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DeliveryLogTable, type DeliveryEvent } from "./DeliveryLogTable";

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type StatusCount = { status: string; count: number };

const STATUSES = ["DELIVERED", "FAILED", "SENT", "PENDING", "UNKNOWN"];
const PROVIDERS = ["sms-retail", "23telecom"];

export default function SmsDeliveryLogPage() {
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const totalEvents = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const deliveredCount = statusCounts.find((s) => s.status === "DELIVERED")?.count ?? 0;
  const failedCount = statusCounts.find((s) => s.status === "FAILED")?.count ?? 0;
  const pendingCount = statusCounts.find((s) => s.status === "PENDING")?.count ?? 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (providerFilter && providerFilter !== "all") params.set("provider", providerFilter);
      if (fromDate) params.set("from", new Date(fromDate).toISOString());
      if (toDate) params.set("to", new Date(toDate + "T23:59:59").toISOString());

      const [logRes, statsRes] = await Promise.all([
        fetch(`/api/sms-delivery-log?${params.toString()}`),
        fetch("/api/sms-delivery-log?limit=1"),
      ]);

      if (logRes.ok) {
        const json = await logRes.json();
        setEvents(json.data ?? []);
        setPagination(json.pagination ?? null);
      }

      // For stats we use a separate simpler approach - count from unfiltered
      if (statsRes.ok) {
        // We'll fetch stats from the service's getStats if available,
        // otherwise just use the total from pagination
        try {
          const statsCheckRes = await fetch("/api/sms-delivery-log/stats");
          if (statsCheckRes.ok) {
            const statsJson = await statsCheckRes.json();
            setStatusCounts(statsJson.byStatus ?? []);
          }
        } catch {
          // Stats endpoint may not exist, use what we have
        }
      }
    } catch (err) {
      console.error("Failed to fetch delivery log:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, providerFilter, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, providerFilter, fromDate, toDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">SMS Delivery Log</h2>
        <p className="text-muted-foreground mt-1">
          Track SMS delivery status callbacks and provider events.
        </p>
      </div>

      {loading && events.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading delivery log...</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEvents}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Delivered</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{deliveredCount}</div>
                {totalEvents > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {((deliveredCount / totalEvents) * 100).toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{failedCount}</div>
                {totalEvents > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {((failedCount / totalEvents) * 100).toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Provider</label>
                  <Select value={providerFilter} onValueChange={setProviderFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All providers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">From</label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">To</label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
                {(statusFilter !== "all" || providerFilter !== "all" || fromDate || toDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusFilter("all");
                      setProviderFilter("all");
                      setFromDate("");
                      setToDate("");
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
              <CardTitle className="text-sm font-medium">Delivery Events</CardTitle>
            </CardHeader>
            <CardContent>
              <DeliveryLogTable events={events} />

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
