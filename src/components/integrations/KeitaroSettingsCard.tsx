"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus";
import { WebhookUrlDisplay } from "./WebhookUrlDisplay";
import { toast } from "sonner";

type KeitaroCampaign = {
  id: number;
  name: string;
  alias: string;
  state: string;
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

  // Campaigns state
  const [campaigns, setCampaigns] = useState<KeitaroCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Postback copy state
  const [copied, setCopied] = useState(false);

  // Test postback state
  const [sendingTestPostback, setSendingTestPostback] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch("/api/keitaro/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(Array.isArray(data) ? data : []);
      }
    } catch {
      // Silently fail — supplementary info
    } finally {
      setLoadingCampaigns(false);
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
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchCampaigns();
    }
  }, [isActive, fetchCampaigns]);

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
          type: "META_CAPI", // closest generic type available
          config: { baseUrl: apiUrl, apiKey },
          isActive: true,
        }),
      });
      if (res.ok) {
        setIsActive(true);
        toast.success("Keitaro configuration saved");
        fetchCampaigns();
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
      } else {
        toast.error("Test postback failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSendingTestPostback(false);
    }
  };

  const connectionStatus = loading
    ? "testing"
    : isActive
      ? "connected"
      : "disconnected";

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
          {/* Base URL */}
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

          {/* API Key */}
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

          {/* Test result indicator */}
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                testResult.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
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

          {/* Actions */}
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

      {/* Live Campaigns */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Keitaro Campaigns</CardTitle>
              <CardDescription className="text-xs">
                Campaigns fetched live from your Keitaro instance
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={fetchCampaigns}
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
          ) : campaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground">No campaigns found.</p>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground font-mono">
                      {c.alias}
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
