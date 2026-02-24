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
  XCircle,
  DollarSign,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Play,
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
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

// ---------- Types ----------

type VapiCallRecord = {
  id: string;
  vapiCallId: string;
  type: string | null;
  status: string;
  assistantId: string | null;
  phoneNumberId: string | null;
  customerNumber: string | null;
  customerName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  duration: number | null;
  cost: number | null;
  summary: string | null;
  successEvaluation: string | null;
  endedReason: string | null;
  recordingUrl: string | null;
  contactAttemptId: string | null;
  leadName: string | null;
  createdAt: string;
};

type VapiCallDetail = VapiCallRecord & {
  costBreakdown: string | null;
  transcript: string | null;
  messages: string | null;
  stereoRecordingUrl: string | null;
  structuredData: string | null;
  updatedAt: string;
  logs: Array<{ id: string; eventType: string; payload: string; createdAt: string }>;
};

type VapiStats = {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgDuration: number;
  totalCost: number;
  costByType: Record<string, number>;
  callsByStatus: Record<string, number>;
  callsByHour: Record<string, number>;
  callsByDay: Record<string, number>;
};

// ---------- Helpers ----------

const statusColors: Record<string, string> = {
  ended: "bg-emerald-100 text-emerald-800",
  "in-progress": "bg-blue-100 text-blue-800",
  ringing: "bg-yellow-100 text-yellow-800",
  queued: "bg-gray-100 text-gray-800",
  scheduled: "bg-purple-100 text-purple-800",
  failed: "bg-red-100 text-red-800",
  "no-answer": "bg-orange-100 text-orange-800",
};

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#6b7280", "#a855f7", "#ef4444", "#f97316"];

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatCost(cost: number | null): string {
  if (cost == null) return "-";
  return `$${cost.toFixed(4)}`;
}

function typeLabel(type: string | null): string {
  if (!type) return "-";
  if (type === "inboundPhoneCall") return "Inbound";
  if (type === "outboundPhoneCall") return "Outbound";
  if (type === "webCall") return "Web";
  return type;
}

// ---------- Component ----------

export default function VapiCallsPage() {
  const [calls, setCalls] = useState<VapiCallRecord[]>([]);
  const [stats, setStats] = useState<VapiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<VapiCallDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
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
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const [callsRes, statsRes] = await Promise.all([
        fetch(`/api/vapi-calls?${params.toString()}`),
        fetch("/api/vapi-calls/stats"),
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
  }, [statusFilter, fromDate, toDate, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [statusFilter, fromDate, toDate]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/vapi-calls/sync", { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // silent
    }
    setSyncing(false);
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setSelectedDetail(null);
    try {
      const res = await fetch(`/api/vapi-calls/${id}`);
      if (res.ok) {
        setSelectedDetail(await res.json());
      }
    } catch {
      // silent
    }
    setDetailLoading(false);
  };

  // Chart data
  const dailyData = stats
    ? Object.entries(stats.callsByDay).map(([date, count]) => ({ date: date.slice(5), count }))
    : [];

  const hourlyData = stats
    ? Object.entries(stats.callsByHour).map(([hour, count]) => ({ hour, count }))
    : [];

  const statusPieData = stats
    ? Object.entries(stats.callsByStatus).map(([name, value]) => ({ name, value }))
    : [];

  const costBarData = stats
    ? Object.entries(stats.costByType)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name: name.toUpperCase(), value }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">VAPI Calls</h2>
          <p className="text-muted-foreground mt-1">
            Synced calls from VAPI with analytics, recordings, and transcripts.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync from VAPI"}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCalls}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successfulCalls}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalCalls > 0 ? ((stats.successfulCalls / stats.totalCalls) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failedCalls}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</div>
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

      {/* Charts Row */}
      {stats && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Calls over time - 30 days */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Calls / Day (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Calls by hour */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Calls by Hour (Last 24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Calls by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cost breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {costBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={costBarData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => `$${Number(v ?? 0).toFixed(4)}`} />
                    <Legend />
                    <Bar dataKey="value" name="Cost ($)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No cost data yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="ringing">Ringing</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="no-answer">No Answer</SelectItem>
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

      {/* Calls Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Recording</TableHead>
                <TableHead>Ended Reason</TableHead>
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
                    No VAPI calls found. Click &quot;Sync from VAPI&quot; to fetch calls.
                  </TableCell>
                </TableRow>
              ) : (
                calls.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(c.id)}
                  >
                    <TableCell className="text-xs whitespace-nowrap">
                      {c.startedAt
                        ? `${new Date(c.startedAt).toLocaleDateString()} ${new Date(c.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs">{typeLabel(c.type)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{c.customerName ?? c.leadName ?? "-"}</div>
                      {c.customerNumber && (
                        <div className="text-xs text-muted-foreground font-mono">{c.customerNumber}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[c.status] ?? ""}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDuration(c.duration)}</TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {formatCost(c.cost)}
                    </TableCell>
                    <TableCell>
                      {c.recordingUrl ? (
                        <Play className="h-4 w-4 text-blue-500" />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[140px] truncate">
                      {c.endedReason ?? "-"}
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
                <span className="text-sm">Page {page} of {totalPages}</span>
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

      {/* Call Detail Dialog */}
      <Dialog
        open={!!selectedDetail || detailLoading}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDetail(null);
            setDetailLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {detailLoading && !selectedDetail && (
            <div className="text-center py-8 text-muted-foreground">Loading call details...</div>
          )}
          {selectedDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Call Details
                  <Badge variant="secondary" className={statusColors[selectedDetail.status] ?? ""}>
                    {selectedDetail.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">VAPI ID:</span>{" "}
                    <span className="font-mono text-xs">{selectedDetail.vapiCallId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    {typeLabel(selectedDetail.type)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer:</span>{" "}
                    {selectedDetail.customerName ?? "-"}
                    {selectedDetail.customerNumber && (
                      <span className="ml-1 font-mono text-xs">({selectedDetail.customerNumber})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>{" "}
                    {formatDuration(selectedDetail.duration)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cost:</span>{" "}
                    {formatCost(selectedDetail.cost)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ended Reason:</span>{" "}
                    {selectedDetail.endedReason ?? "-"}
                  </div>
                  {selectedDetail.startedAt && (
                    <div>
                      <span className="text-muted-foreground">Started:</span>{" "}
                      {new Date(selectedDetail.startedAt).toLocaleString()}
                    </div>
                  )}
                  {selectedDetail.endedAt && (
                    <div>
                      <span className="text-muted-foreground">Ended:</span>{" "}
                      {new Date(selectedDetail.endedAt).toLocaleString()}
                    </div>
                  )}
                  {selectedDetail.leadName && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Linked Lead:</span>{" "}
                      {selectedDetail.leadName}
                    </div>
                  )}
                </div>

                {/* Cost Breakdown */}
                {selectedDetail.costBreakdown && selectedDetail.costBreakdown !== "{}" && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Cost Breakdown</h4>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        try {
                          const bd = JSON.parse(selectedDetail.costBreakdown) as Record<string, number>;
                          return Object.entries(bd)
                            .filter(([, v]) => v > 0)
                            .map(([k, v]) => (
                              <Badge key={k} variant="outline" className="text-xs">
                                {k.toUpperCase()}: ${v.toFixed(4)}
                              </Badge>
                            ));
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                )}

                {/* Recording Player */}
                {selectedDetail.recordingUrl && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Recording</h4>
                    <audio
                      controls
                      className="w-full"
                      src={selectedDetail.recordingUrl}
                    >
                      Your browser does not support the audio element.
                    </audio>
                    <div className="flex gap-2 mt-2">
                      <a
                        href={selectedDetail.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-500 hover:underline"
                      >
                        Download Mono Recording
                      </a>
                      {selectedDetail.stereoRecordingUrl && (
                        <a
                          href={selectedDetail.stereoRecordingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          Download Stereo Recording
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Analysis */}
                {(selectedDetail.summary || selectedDetail.successEvaluation) && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Analysis</h4>
                    {selectedDetail.summary && (
                      <div className="bg-muted p-3 rounded-md text-sm mb-2">
                        <span className="font-medium">Summary: </span>
                        {selectedDetail.summary}
                      </div>
                    )}
                    {selectedDetail.successEvaluation && (
                      <div className="bg-muted p-3 rounded-md text-sm mb-2">
                        <span className="font-medium">Success: </span>
                        {selectedDetail.successEvaluation}
                      </div>
                    )}
                    {selectedDetail.structuredData && selectedDetail.structuredData !== "{}" && (
                      <div className="bg-muted p-3 rounded-md text-xs font-mono whitespace-pre-wrap">
                        {JSON.stringify(JSON.parse(selectedDetail.structuredData), null, 2)}
                      </div>
                    )}
                  </div>
                )}

                {/* Transcript */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Transcript</h4>
                  <div className="bg-muted p-4 rounded-md text-sm max-h-[40vh] overflow-y-auto space-y-2">
                    {selectedDetail.messages && selectedDetail.messages !== "[]" ? (
                      (() => {
                        try {
                          const msgs = JSON.parse(selectedDetail.messages) as Array<{ role: string; content: string }>;
                          return msgs.map((m, i) => (
                            <div key={i} className="flex gap-2">
                              <span
                                className={`font-medium text-xs min-w-[70px] ${
                                  m.role === "user" || m.role === "customer"
                                    ? "text-blue-600"
                                    : m.role === "assistant" || m.role === "bot"
                                    ? "text-emerald-600"
                                    : "text-gray-500"
                                }`}
                              >
                                {m.role}:
                              </span>
                              <span className="text-sm">{m.content}</span>
                            </div>
                          ));
                        } catch {
                          return <p className="whitespace-pre-wrap font-mono text-xs">{selectedDetail.messages}</p>;
                        }
                      })()
                    ) : selectedDetail.transcript ? (
                      <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                        {selectedDetail.transcript}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">No transcript available.</p>
                    )}
                  </div>
                </div>

                {/* Event Logs */}
                {selectedDetail.logs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Event Logs ({selectedDetail.logs.length})</h4>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {selectedDetail.logs.map((log) => (
                        <div key={log.id} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                          <Badge variant="outline" className="text-xs">{log.eventType}</Badge>
                        </div>
                      ))}
                    </div>
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
