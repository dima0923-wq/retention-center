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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  Clock,
  CheckCircle2,
  DollarSign,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type CallRecord = {
  id: string;
  leadName: string;
  phone: string | null;
  campaignId: string | null;
  campaignName: string | null;
  status: string;
  provider: string | null;
  providerRef: string | null;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  cost: number | null;
  transcript: string | null;
  keywords: string[];
  summary: string | null;
  notes: string | null;
};

type CallStats = {
  totalCalls: number;
  successCalls: number;
  avgDuration: number;
  totalCost: number;
  successRate: number;
};

type Campaign = {
  id: string;
  name: string;
};

const statusColors: Record<string, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  NO_ANSWER: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  BUSY: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTranscript(transcript: unknown): string {
  if (!transcript) return "No transcript available.";
  if (typeof transcript === "string") return transcript;
  if (Array.isArray(transcript)) {
    return transcript
      .map((msg: { role?: string; content?: string; message?: string }) => {
        const role = (msg.role ?? "unknown").charAt(0).toUpperCase() + (msg.role ?? "unknown").slice(1);
        const text = msg.content ?? msg.message ?? JSON.stringify(msg);
        return `${role}: ${text}`;
      })
      .join("\n\n");
  }
  return JSON.stringify(transcript, null, 2);
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (campaignFilter && campaignFilter !== "all") params.set("campaignId", campaignFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const [callsRes, statsRes] = await Promise.all([
        fetch(`/api/calls?${params.toString()}`),
        fetch("/api/calls/stats"),
      ]);

      if (callsRes.ok) {
        const json = await callsRes.json();
        setCalls(json.data ?? []);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [statusFilter, campaignFilter, fromDate, toDate, page]);

  // Fetch campaigns for filter
  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setCampaigns(json.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, campaignFilter, fromDate, toDate]);

  const handleExportCSV = () => {
    const headers = ["Date", "Lead", "Phone", "Campaign", "Status", "Duration (s)", "Cost", "Keywords"];
    const rows = calls.map((c) => [
      new Date(c.startedAt).toLocaleString(),
      c.leadName,
      c.phone ?? "",
      c.campaignName ?? "",
      c.status,
      c.duration?.toString() ?? "",
      c.cost?.toFixed(2) ?? "",
      c.keywords.join("; "),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calls-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Call History</h2>
          <p className="text-muted-foreground mt-1">
            View and analyze all VAPI call attempts and transcripts.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={calls.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCalls}</div>
              <p className="text-xs text-muted-foreground">
                {stats.successCalls} successful
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</div>
              <p className="text-xs text-muted-foreground">Per call</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Completed / Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalCost.toFixed(2)}</div>
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
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="NO_ANSWER">No Answer</SelectItem>
                  <SelectItem value="BUSY">Busy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Campaign</Label>
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
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
                <TableHead>Lead</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Keywords</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : calls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No calls found
                  </TableCell>
                </TableRow>
              ) : (
                calls.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedCall(c)}
                  >
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(c.startedAt).toLocaleDateString()}{" "}
                      {new Date(c.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{c.leadName}</TableCell>
                    <TableCell className="text-xs font-mono">{c.phone ?? "-"}</TableCell>
                    <TableCell className="text-xs">{c.campaignName ?? "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusColors[c.status] ?? ""}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDuration(c.duration)}</TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {c.cost != null ? `$${c.cost.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {c.keywords.length > 0
                        ? c.keywords.slice(0, 3).join(", ")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedCall && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Call Details — {selectedCall.leadName}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Call metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    <span className="font-mono">{selectedCall.phone ?? "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <Badge variant="secondary" className={statusColors[selectedCall.status] ?? ""}>
                      {selectedCall.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Started:</span>{" "}
                    {new Date(selectedCall.startedAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>{" "}
                    {formatDuration(selectedCall.duration)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Campaign:</span>{" "}
                    {selectedCall.campaignName ?? "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cost:</span>{" "}
                    {selectedCall.cost != null ? `$${selectedCall.cost.toFixed(2)}` : "-"}
                  </div>
                  {selectedCall.provider && (
                    <div>
                      <span className="text-muted-foreground">Provider:</span>{" "}
                      {selectedCall.provider}
                    </div>
                  )}
                  {selectedCall.providerRef && (
                    <div>
                      <span className="text-muted-foreground">Ref:</span>{" "}
                      <span className="font-mono text-xs">{selectedCall.providerRef}</span>
                    </div>
                  )}
                </div>

                {/* Keywords */}
                {selectedCall.keywords.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Keywords</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCall.keywords.map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                {selectedCall.summary && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Summary</h4>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                      {selectedCall.summary}
                    </p>
                  </div>
                )}

                {/* Transcript */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Transcript</h4>
                  <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap font-mono leading-relaxed max-h-[40vh] overflow-y-auto">
                    {formatTranscript(selectedCall.transcript)}
                  </div>
                </div>

                {/* Notes */}
                {selectedCall.notes && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground">{selectedCall.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
