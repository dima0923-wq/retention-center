"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  BarChart3,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  Send,
  Link2,
  Unlink,
} from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus";
import { toast } from "sonner";

type KeitaroCampaign = {
  id: number;
  name: string;
  alias: string;
  state: string;
};

type RcCampaign = {
  id: string;
  name: string;
  status: string;
};

type Mapping = {
  id: string;
  keitaroCampaignId: string;
  keitaroCampaignName: string | null;
  campaignId: string | null;
  isActive: boolean;
  campaign: { id: string; name: string; status: string } | null;
};

type Conversion = {
  id: string;
  subId: string | null;
  clickId: string | null;
  status: string;
  revenue: number;
  source: string;
  keitaroCampaignId: string | null;
  keitaroCampaignName: string | null;
  createdAt: string;
};

const statusColors: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  sale: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  reject: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function KeitaroSettingsCard() {
  const baseUrl = getBaseUrl();
  const postbackUrl = `${baseUrl}/api/webhooks/keitaro?sub_id={subid}&status={status}&payout={payout}&click_id={clickid}`;

  // Config state
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Connection test state
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Keitaro campaigns
  const [keitaroCampaigns, setKeitaroCampaigns] = useState<KeitaroCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // RC campaigns
  const [rcCampaigns, setRcCampaigns] = useState<RcCampaign[]>([]);

  // Campaign mappings
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [savingMapping, setSavingMapping] = useState<string | null>(null);

  // Recent postbacks
  const [recentPostbacks, setRecentPostbacks] = useState<Conversion[]>([]);
  const [loadingPostbacks, setLoadingPostbacks] = useState(false);

  // Postback copy state
  const [copied, setCopied] = useState(false);

  // Test postback state
  const [sendingTestPostback, setSendingTestPostback] = useState(false);

  const fetchKeitaroCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch("/api/keitaro/campaigns");
      if (res.ok) {
        const data = await res.json();
        setKeitaroCampaigns(Array.isArray(data) ? data : []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    setLoadingMappings(true);
    try {
      const res = await fetch("/api/keitaro/campaign-mappings");
      if (res.ok) {
        const data = await res.json();
        setMappings(Array.isArray(data) ? data : []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingMappings(false);
    }
  }, []);

  const fetchRcCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns?limit=100");
      if (res.ok) {
        const data = await res.json();
        const list = data.data ?? data;
        setRcCampaigns(Array.isArray(list) ? list : []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const fetchRecentPostbacks = useCallback(async () => {
    setLoadingPostbacks(true);
    try {
      const res = await fetch("/api/conversions?limit=20");
      if (res.ok) {
        const data = await res.json();
        const list = data.data ?? data;
        setRecentPostbacks(Array.isArray(list) ? list : []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingPostbacks(false);
    }
  }, []);

  // Load saved config from integrations table
  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Array<{ provider: string; config: Record<string, unknown> | string; isActive: boolean }>) => {
        const entry = list.find((i) => i.provider === "keitaro");
        if (entry?.config) {
          const cfg =
            typeof entry.config === "string"
              ? (JSON.parse(entry.config) as Record<string, unknown>)
              : entry.config;
          setApiUrl((cfg.baseUrl as string) ?? "");
          setApiKey((cfg.apiKey as string) ?? "");
          setIsActive(entry.isActive);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetchMappings();
    fetchRcCampaigns();
    fetchRecentPostbacks();
  }, [fetchMappings, fetchRcCampaigns, fetchRecentPostbacks]);

  useEffect(() => {
    if (isActive) {
      fetchKeitaroCampaigns();
    }
  }, [isActive, fetchKeitaroCampaigns]);

  const handleSave = async () => {
    if (!apiUrl || !apiKey) {
      toast.error("Please enter both Base URL and API Key");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "keitaro",
          type: "META_CAPI",
          config: { baseUrl: apiUrl, apiKey },
          isActive: true,
        }),
      });
      if (res.ok) {
        setIsActive(true);
        toast.success("Keitaro configuration saved");
        fetchKeitaroCampaigns();
      } else {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? "Failed to save");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/keitaro/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: apiUrl, apiKey }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      setTestResult(data);
      if (data.ok) {
        toast.success("Connection successful");
      } else {
        toast.error(data.message ?? "Connection failed");
      }
    } catch {
      const err = { ok: false, message: "Network error" };
      setTestResult(err);
      toast.error("Network error");
    } finally {
      setTesting(false);
    }
  };

  const handleCopyPostback = async () => {
    await navigator.clipboard.writeText(postbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestPostback = async () => {
    setSendingTestPostback(true);
    try {
      const res = await fetch("/api/webhooks/keitaro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sub_id: "test_" + Date.now(),
          status: "lead",
          payout: "0",
          click_id: "test_click_" + Date.now(),
        }),
      });
      if (res.ok) {
        toast.success("Test postback sent successfully");
        fetchRecentPostbacks();
      } else {
        toast.error("Test postback failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSendingTestPostback(false);
    }
  };

  const handleSaveMapping = async (keitaroCampaignId: string, keitaroCampaignName: string, rcCampaignId: string | null) => {
    setSavingMapping(keitaroCampaignId);
    try {
      const res = await fetch("/api/keitaro/campaign-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keitaroCampaignId,
          keitaroCampaignName,
          campaignId: rcCampaignId === "none" ? null : rcCampaignId,
          isActive: true,
        }),
      });
      if (res.ok) {
        toast.success("Campaign mapping saved");
        fetchMappings();
      } else {
        toast.error("Failed to save mapping");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingMapping(null);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    try {
      const res = await fetch(`/api/keitaro/campaign-mappings/${mappingId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Mapping removed");
        fetchMappings();
      } else {
        toast.error("Failed to remove mapping");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const connectionStatus = loading
    ? "testing"
    : isActive
      ? "connected"
      : "disconnected";

  // Build a lookup: keitaroCampaignId -> mapping
  const mappingByKeitaroId = new Map(mappings.map((m) => [m.keitaroCampaignId, m]));

  return (
    <div className="space-y-6">
      {/* API Connection Config */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Keitaro API Connection</CardTitle>
              <CardDescription className="text-xs">
                Connect to your Keitaro tracker instance
              </CardDescription>
            </div>
          </div>
          <ConnectionStatus status={connectionStatus} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="keitaro-baseUrl" className="text-xs">
              Keitaro Base URL
            </Label>
            <Input
              id="keitaro-baseUrl"
              type="url"
              placeholder="https://your-keitaro-domain.com"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="keitaro-apiKey" className="text-xs">
              API Key
            </Label>
            <Input
              id="keitaro-apiKey"
              type="password"
              placeholder="Your Keitaro API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                testResult.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="text-xs">{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || !apiUrl || !apiKey}
            >
              {testing ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : null}
              Test Connection
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Postback URL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Postback URL</CardTitle>
          <CardDescription className="text-xs">
            Configure this URL in Keitaro to receive conversion postbacks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Postback URL Template</Label>
            <div className="flex gap-2">
              <Input value={postbackUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopyPostback}>
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Parameter Mapping</Label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{"{subid}"}</Badge>
                <span className="text-muted-foreground">Contact / lead ID</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{"{status}"}</Badge>
                <span className="text-muted-foreground">lead / sale / reject</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{"{payout}"}</Badge>
                <span className="text-muted-foreground">Revenue amount</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{"{clickid}"}</Badge>
                <span className="text-muted-foreground">Keitaro click ID</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestPostback}
              disabled={sendingTestPostback}
            >
              {sendingTestPostback ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-2 h-3 w-3" />
              )}
              Send Test Postback
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Mapping */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Campaign Mapping</CardTitle>
              <CardDescription className="text-xs">
                Link Keitaro campaigns to Retention Center campaigns for attribution
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                fetchKeitaroCampaigns();
                fetchMappings();
              }}
              disabled={loadingCampaigns || !isActive}
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loadingCampaigns ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!isActive ? (
            <p className="text-xs text-muted-foreground">
              Save your API credentials above to configure campaign mappings.
            </p>
          ) : loadingCampaigns ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading campaigns...
            </div>
          ) : keitaroCampaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground">No Keitaro campaigns found.</p>
          ) : (
            <div className="space-y-2">
              {keitaroCampaigns.map((kc) => {
                const mapping = mappingByKeitaroId.get(String(kc.id));
                const currentRcId = mapping?.campaignId ?? "none";
                const isSaving = savingMapping === String(kc.id);

                return (
                  <div
                    key={kc.id}
                    className="flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    {/* Keitaro side */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{kc.name}</p>
                      <p className="truncate text-xs text-muted-foreground font-mono">{kc.alias}</p>
                    </div>

                    {/* Arrow */}
                    <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />

                    {/* RC side selector */}
                    <div className="w-48 shrink-0">
                      <Select
                        value={currentRcId ?? "none"}
                        onValueChange={(val) =>
                          handleSaveMapping(String(kc.id), kc.name, val === "none" ? null : val)
                        }
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select RC campaign..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">Not mapped</span>
                          </SelectItem>
                          {rcCampaigns.map((rc) => (
                            <SelectItem key={rc.id} value={rc.id}>
                              {rc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status badge */}
                    <Badge
                      variant={kc.state === "active" ? "default" : "secondary"}
                      className="shrink-0 capitalize text-xs"
                    >
                      {kc.state}
                    </Badge>

                    {/* Unlink button if mapped */}
                    {mapping && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500"
                        onClick={() => handleDeleteMapping(mapping.id)}
                        title="Remove mapping"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Existing mappings for campaigns not in current list */}
          {mappings.filter((m) => !keitaroCampaigns.find((kc) => String(kc.id) === m.keitaroCampaignId)).length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-muted-foreground font-medium">Saved mappings (campaign not in current list)</p>
              <div className="space-y-2">
                {mappings
                  .filter((m) => !keitaroCampaigns.find((kc) => String(kc.id) === m.keitaroCampaignId))
                  .map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2 text-xs text-muted-foreground"
                    >
                      <span className="font-mono flex-1">{m.keitaroCampaignName ?? m.keitaroCampaignId}</span>
                      <span>→</span>
                      <span className="flex-1">{m.campaign?.name ?? "Not mapped"}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-red-500"
                        onClick={() => handleDeleteMapping(m.id)}
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Postbacks */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Postbacks</CardTitle>
              <CardDescription className="text-xs">
                Latest conversions received from Keitaro
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={fetchRecentPostbacks}
              disabled={loadingPostbacks}
            >
              <RefreshCw className={`h-4 w-4 ${loadingPostbacks ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPostbacks ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading postbacks...
            </div>
          ) : recentPostbacks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No postbacks received yet. Use &quot;Send Test Postback&quot; above to verify the setup.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Sub ID</TableHead>
                  <TableHead className="text-xs">Campaign</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPostbacks.map((pb) => (
                  <TableRow key={pb.id}>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {new Date(pb.createdAt).toLocaleDateString()}{" "}
                      {new Date(pb.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {pb.subId ? pb.subId.slice(0, 12) + (pb.subId.length > 12 ? "…" : "") : "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {pb.keitaroCampaignName ?? pb.keitaroCampaignId ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${statusColors[pb.status] ?? ""}`}
                      >
                        {pb.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      ${pb.revenue.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Keitaro Campaigns reference list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Keitaro Campaigns</CardTitle>
              <CardDescription className="text-xs">
                All campaigns fetched live from your Keitaro instance
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={fetchKeitaroCampaigns}
              disabled={loadingCampaigns || !isActive}
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingCampaigns ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!isActive ? (
            <p className="text-xs text-muted-foreground">
              Save your API credentials above to view campaigns.
            </p>
          ) : loadingCampaigns ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading campaigns...
            </div>
          ) : keitaroCampaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground">No campaigns found.</p>
          ) : (
            <div className="space-y-2">
              {keitaroCampaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground font-mono">
                      ID: {c.id} · {c.alias}
                    </p>
                  </div>
                  <Badge
                    variant={c.state === "active" ? "default" : "secondary"}
                    className="ml-3 shrink-0 capitalize text-xs"
                  >
                    {c.state}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
