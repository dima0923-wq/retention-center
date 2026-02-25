"use client";

import { useState, useEffect } from "react";
import { BarChart3, Copy, Check, Send, Loader2, ExternalLink, Wifi, WifiOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatus } from "./ConnectionStatus";
import { toast } from "sonner";
import Link from "next/link";

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

type Stats = {
  total: number;
  today: number;
  thisWeek: number;
};

type ConnStatus = "connected" | "disconnected" | "testing";

export function KeitaroIntegrationCard() {
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, thisWeek: 0 });
  const [testing, setTesting] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnStatus>("testing");
  const [campaignCount, setCampaignCount] = useState<number | null>(null);

  const baseUrl = getBaseUrl();
  const postbackUrl = `${baseUrl}/api/webhooks/keitaro?sub_id={subid}&status={status}&payout={payout}&click_id={clickid}`;

  useEffect(() => {
    fetch("/api/conversions/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setStats({ total: data.total, today: data.today, thisWeek: data.thisWeek });
        }
      })
      .catch(() => {});

    // Test connection on mount
    testConnection(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const testConnection = async (showToast = true) => {
    setTestingConn(true);
    try {
      const res = await fetch("/api/keitaro/test", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setConnStatus("connected");
        if (showToast) toast.success("Keitaro connection successful");
        // Fetch campaign count
        const campRes = await fetch("/api/keitaro/campaigns");
        if (campRes.ok) {
          const camps = await campRes.json();
          setCampaignCount(Array.isArray(camps) ? camps.length : null);
        }
      } else {
        setConnStatus("disconnected");
        if (showToast) toast.error(`Connection failed: ${data.message}`);
      }
    } catch {
      setConnStatus("disconnected");
      if (showToast) toast.error("Network error testing connection");
    }
    setTestingConn(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(postbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestPostback = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${baseUrl}/api/webhooks/keitaro`, {
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
        const statsRes = await fetch("/api/conversions/stats");
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats({ total: data.total, today: data.today, thisWeek: data.thisWeek });
        }
      } else {
        toast.error("Test postback failed");
      }
    } catch {
      toast.error("Network error sending test postback");
    }
    setTesting(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Keitaro Tracker</CardTitle>
            <CardDescription className="text-xs">
              Receive conversion postbacks &amp; sync campaign data
            </CardDescription>
          </div>
        </div>
        <ConnectionStatus status={connStatus} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection info */}
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {connStatus === "connected" ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            ) : connStatus === "disconnected" ? (
              <WifiOff className="h-3.5 w-3.5 text-red-500" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            <span>
              {connStatus === "connected"
                ? campaignCount !== null
                  ? `Connected — ${campaignCount} campaign${campaignCount !== 1 ? "s" : ""}`
                  : "Connected"
                : connStatus === "disconnected"
                ? "API connection failed"
                : "Checking connection..."}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => testConnection(true)}
            disabled={testingConn}
          >
            {testingConn ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : null}
            Test Connection
          </Button>
        </div>

        {/* Postback URL */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Postback URL Template</Label>
          <div className="flex gap-2">
            <Input value={postbackUrl} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Parameter mapping */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Parameter Mapping</Label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">{"{subid}"}</Badge>
              <span className="text-muted-foreground">Contact attempt / lead ID</span>
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

        {/* Conversion stats */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Recent Conversions</Label>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border p-2 text-center">
              <p className="text-lg font-semibold">{stats.today}</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div className="rounded-md border p-2 text-center">
              <p className="text-lg font-semibold">{stats.thisWeek}</p>
              <p className="text-xs text-muted-foreground">This Week</p>
            </div>
            <div className="rounded-md border p-2 text-center">
              <p className="text-lg font-semibold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href="/integrations/keitaro"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Full Settings
          </Link>
          <Button size="sm" variant="outline" onClick={handleTestPostback} disabled={testing}>
            {testing ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Send className="mr-2 h-3 w-3" />
            )}
            Test Postback
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
