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
import {
  Send,
  Loader2,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus";
import { WebhookUrlDisplay } from "./WebhookUrlDisplay";
import { toast } from "sonner";

export function PostmarkIntegrationCard() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Post-connection state
  const [serverName, setServerName] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const fetchDetails = useCallback(async () => {
    setLoadingDetails(true);
    try {
      const res = await fetch("/api/integrations/postmark/test");
      if (res.ok) {
        const data = await res.json();
        setServerName(data.serverName ?? data.name ?? null);
      }
    } catch {
      // Details are supplementary
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/integrations/postmark")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.config) {
          try {
            const parsed =
              typeof data.config === "string"
                ? JSON.parse(data.config)
                : data.config;
            setConfig(parsed as Record<string, string>);
            setIsActive(data.isActive);
          } catch {
            // malformed config — ignore
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchDetails();
    }
  }, [isActive, fetchDetails]);

  const updateField = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "postmark",
          type: "EMAIL",
          config,
          isActive: true,
        }),
      });
      if (res.ok) {
        setIsActive(true);
        toast.success("Postmark configuration saved");
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

  const handleDeactivate = async () => {
    const res = await fetch("/api/integrations/postmark", {
      method: "DELETE",
    });
    if (res.ok) {
      setIsActive(false);
      setServerName(null);
      toast.success("Postmark deactivated");
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/postmark/test");
      if (res.ok) {
        const data = await res.json();
        setServerName(data.serverName ?? data.name ?? null);
        toast.success("Postmark connection verified");
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Connection test failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setTesting(false);
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
            <Send className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Postmark</CardTitle>
            <CardDescription className="text-xs">
              Transactional email delivery via Postmark
            </CardDescription>
          </div>
        </div>
        <ConnectionStatus status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Server Token (API Key) */}
        <div className="space-y-1.5">
          <Label htmlFor="postmark-serverToken" className="text-xs">
            Server Token
          </Label>
          <Input
            id="postmark-serverToken"
            type="password"
            placeholder="Your Postmark Server Token"
            value={config.serverToken ?? ""}
            onChange={(e) => updateField("serverToken", e.target.value)}
          />
        </div>

        {/* From Email */}
        <div className="space-y-1.5">
          <Label htmlFor="postmark-fromEmail" className="text-xs">
            From Email
          </Label>
          <Input
            id="postmark-fromEmail"
            type="email"
            placeholder="noreply@example.com"
            value={config.fromEmail ?? ""}
            onChange={(e) => updateField("fromEmail", e.target.value)}
          />
        </div>

        {/* From Name */}
        <div className="space-y-1.5">
          <Label htmlFor="postmark-fromName" className="text-xs">
            From Name
          </Label>
          <Input
            id="postmark-fromName"
            type="text"
            placeholder="Retention Center"
            value={config.fromName ?? ""}
            onChange={(e) => updateField("fromName", e.target.value)}
          />
        </div>

        {/* Webhook URL */}
        <WebhookUrlDisplay
          label="Webhook URL"
          url={`${baseUrl}/api/webhooks/postmark`}
        />

        {/* Post-connection details */}
        {isActive && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Connection Details</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={fetchDetails}
                disabled={loadingDetails}
              >
                <RefreshCw
                  className={`h-3 w-3 ${loadingDetails ? "animate-spin" : ""}`}
                />
              </Button>
            </div>

            {serverName && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                <span>Server: {serverName}</span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing && (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              )}
              Test Connection
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          {isActive && (
            <Button variant="ghost" size="sm" onClick={handleDeactivate}>
              Deactivate
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
