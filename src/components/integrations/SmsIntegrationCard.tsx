"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { MessageSquare, Loader2, CheckCircle, XCircle } from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus";
import { toast } from "sonner";

type SmsProvider = "sms-retail" | "23telecom";

type TestResult = {
  success: boolean;
  balance?: string;
  error?: string;
};

const providerLabels: Record<SmsProvider, string> = {
  "sms-retail": "SMS-Retail",
  "23telecom": "23 Telecom",
};

const channelTypes = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "imo", label: "IMO" },
  { value: "viber", label: "Viber" },
];

export function SmsIntegrationCard() {
  const [provider, setProvider] = useState<SmsProvider>("sms-retail");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      try {
        // Try loading sms-retail first, then 23telecom
        for (const p of ["sms-retail", "23telecom"] as SmsProvider[]) {
          const res = await fetch(`/api/integrations/${p}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.config) {
              setProvider(p);
              const parsed = typeof data.config === "string" ? JSON.parse(data.config) : data.config;
              setConfig(parsed as Record<string, string>);
              setIsActive(data.isActive);
              break;
            }
          }
        }
      } catch {
        // No existing config
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleProviderChange = (value: string) => {
    setProvider(value as SmsProvider);
    setConfig({});
    setTestResult(null);
  };

  const updateField = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/integrations/${provider}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ success: true, balance: data.balance });
        toast.success("Connection successful");
      } else {
        setTestResult({ success: false, error: data.error ?? "Connection failed" });
        toast.error(data.error ?? "Connection failed");
      }
    } catch {
      setTestResult({ success: false, error: "Network error" });
      toast.error("Network error");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          type: "SMS",
          config,
          isActive: true,
        }),
      });
      if (res.ok) {
        setIsActive(true);
        toast.success(`${providerLabels[provider]} configuration saved`);
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const status = loading
    ? "testing"
    : isActive
      ? "connected"
      : "disconnected";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">SMS Gateway</CardTitle>
            <CardDescription className="text-xs">
              Send SMS messages via SMS-Retail or 23 Telecom
            </CardDescription>
          </div>
        </div>
        <ConnectionStatus status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider selector */}
        <div className="space-y-1.5">
          <Label className="text-xs">SMS Provider</Label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sms-retail">SMS-Retail</SelectItem>
              <SelectItem value="23telecom">23 Telecom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic fields based on provider */}
        {provider === "sms-retail" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="sms-retail-apiKey" className="text-xs">
                API Key
              </Label>
              <Input
                id="sms-retail-apiKey"
                type="password"
                placeholder="Your SMS-Retail API key"
                value={config.apiKey ?? ""}
                onChange={(e) => updateField("apiKey", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Channel Type</Label>
              <Select
                value={config.channelType ?? ""}
                onValueChange={(v) => updateField("channelType", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  {channelTypes.map((ch) => (
                    <SelectItem key={ch.value} value={ch.value}>
                      {ch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">API URL</Label>
              <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                https://23telecomrestapi.com/sms/api?
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="23t-username" className="text-xs">
                Username
              </Label>
              <Input
                id="23t-username"
                type="text"
                placeholder="Your username"
                value={config.username ?? ""}
                onChange={(e) => updateField("username", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="23t-password" className="text-xs">
                Password
              </Label>
              <Input
                id="23t-password"
                type="password"
                placeholder="Your password"
                value={config.password ?? ""}
                onChange={(e) => updateField("password", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="23t-senderId" className="text-xs">
                Sender ID
              </Label>
              <Input
                id="23t-senderId"
                type="text"
                placeholder="CompanyName"
                value={config.senderId ?? ""}
                onChange={(e) => updateField("senderId", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="23t-serviceType" className="text-xs">
                Service Type{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="23t-serviceType"
                type="text"
                placeholder="optional"
                value={config.serviceType ?? ""}
                onChange={(e) => updateField("serviceType", e.target.value)}
              />
            </div>
          </>
        )}

        {/* Test result */}
        {testResult && (
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            {testResult.success ? (
              <>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-emerald-600">Connected</span>
                {testResult.balance && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    Balance: {testResult.balance}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600">{testResult.error}</span>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
          >
            {testing && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Test Connection
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
