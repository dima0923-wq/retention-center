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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, DollarSign, Target, BarChart3 } from "lucide-react";

type Conversion = {
  id: string;
  leadId: string | null;
  campaignId: string | null;
  channel: string | null;
  revenue: number;
  status: string;
  subId: string | null;
  clickId: string | null;
  source: string;
  createdAt: string;
};

type Stats = {
  total: number;
  today: number;
  thisWeek: number;
  totalRevenue: number;
  conversionRate: number;
  avgRevenue: number;
};

const statusColors: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  sale: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  reject: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function ConversionsPage() {
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (channelFilter && channelFilter !== "all") params.set("channel", channelFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const [convRes, statsRes] = await Promise.all([
        fetch(`/api/conversions?${params.toString()}`),
        fetch("/api/conversions/stats"),
      ]);

      if (convRes.ok) {
        const json = await convRes.json();
        setConversions(json.data ?? json);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [statusFilter, channelFilter, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCSV = () => {
    const headers = ["Date", "Lead ID", "Channel", "Campaign", "Status", "Revenue", "Source", "Click ID"];
    const rows = conversions.map((c) => [
      new Date(c.createdAt).toLocaleString(),
      c.leadId ?? "",
      c.channel ?? "",
      c.campaignId ?? "",
      c.status,
      c.revenue.toFixed(2),
      c.source,
      c.clickId ?? "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get unique channels from conversions for filter
  const channels = Array.from(new Set(conversions.map((c) => c.channel).filter(Boolean))) as string[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Conversions</h2>
          <p className="text-muted-foreground mt-1">
            Track conversion postbacks from Keitaro and other sources.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={conversions.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.today} today / {stats.thisWeek} this week
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Sales / Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Revenue</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.avgRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Per sale</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Channel</Label>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {channels.map((ch) => (
                    <SelectItem key={ch} value={ch}>
                      {ch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Lead ID</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : conversions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No conversions found
                  </TableCell>
                </TableRow>
              ) : (
                conversions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString()}{" "}
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {c.leadId ? c.leadId.slice(0, 8) + "..." : "-"}
                    </TableCell>
                    <TableCell className="text-xs">{c.channel ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {c.campaignId ? c.campaignId.slice(0, 8) + "..." : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusColors[c.status] ?? ""}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${c.revenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.source}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
