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
  Mail,
  Loader2,
  CheckCircle,
  XCircle,
  Webhook,
  RefreshCw,
} from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus";
import { WebhookUrlDisplay } from "./WebhookUrlDisplay";
import { toast } from "sonner";

type Campaign = {
  id: string;
  name: string;
  status?: string;
};

export function InstantlyIntegrationCard() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Post-connection state
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [settingUpWebhooks, setSettingUpWebhooks] = useState(false);
  const [webhookSetup, setWebhookSetup] = useState(false);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const fetchDetails = useCallback(async () => {
    setLoadingDetails(true);
    try {
      const [accRes, campRes] = await Promise.all([
        fetch("/api/integrations/instantly/accounts"),
        fetch("/api/integrations/instantly/campaigns"),
      ]);
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccountCount(accData.total ?? accData.accounts?.length ?? 0);
      }
      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaigns(campData.campaigns ?? []);
      }
    } catch {
      // Silently fail — details are supplementary
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/integrations/instantly")
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
          provider: "instantly",
          type: "EMAIL",
          config,
          isActive: true,
        }),
      });
      if (res.ok) {
        setIsActive(true);
        toast.success("Instantly.ai configuration saved");
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
    const res = await fetch("/api/integrations/instantly", {
      method: "DELETE",
    });
    if (res.ok) {
      setIsActive(false);
      setAccountCount(null);
      setCampaigns([]);
      setWebhookSetup(false);
      toast.success("Instantly.ai deactivated");
    }
  };

  const handleSetupWebhooks = async () => {
    setSettingUpWebhooks(true);
    try {
      const res = await fetch("/api/integrations/instantly/webhook-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto: true, webhook_url: `${baseUrl}/api/webhooks/instantly` }),
      });
      if (res.ok) {
        setWebhookSetup(true);
        toast.success("Webhooks configured successfully");
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to setup webhooks");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSettingUpWebhooks(false);
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
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Instantly.ai</CardTitle>
            <CardDescription className="text-xs">
              Cold email outreach automation via Instantly.ai
            </CardDescription>
          </div>
        </div>
        <ConnectionStatus status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Key */}
        <div className="space-y-1.5">
          <Label htmlFor="instantly-apiKey" className="text-xs">
            API Key
          </Label>
          <Input
            id="instantly-apiKey"
            type="password"
            placeholder="Your Instantly.ai API key"
            value={config.apiKey ?? ""}
            onChange={(e) => updateField("apiKey", e.target.value)}
          />
        </div>

        {/* Default Campaign ID */}
        <div className="space-y-1.5">
          <Label htmlFor="instantly-campaignId" className="text-xs">
            Default Campaign ID
          </Label>
          <Input
            id="instantly-campaignId"
            type="text"
            placeholder="Campaign ID for lead assignment"
            value={config.defaultCampaignId ?? ""}
            onChange={(e) => updateField("defaultCampaignId", e.target.value)}
          />
        </div>

        {/* Webhook URL */}
        <WebhookUrlDisplay
          label="Webhook URL"
          url={`${baseUrl}/api/webhooks/instantly`}
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

            {/* Account count */}
            {accountCount !== null && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                <span>
                  {accountCount} email account{accountCount !== 1 ? "s" : ""}{" "}
                  connected
                </span>
              </div>
            )}

            {/* Campaigns list */}
            {campaigns.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">
                  Campaigns
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {campaigns.map((c) => (
                    <Badge
                      key={c.id}
                      variant="secondary"
                      className="text-xs font-normal"
                    >
                      {c.name}
                      {c.status && (
                        <span className="ml-1 text-muted-foreground">
                          ({c.status})
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Webhook setup button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSetupWebhooks}
              disabled={settingUpWebhooks || webhookSetup}
            >
              {settingUpWebhooks && (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              )}
              {webhookSetup ? (
                <>
                  <CheckCircle className="mr-2 h-3 w-3 text-emerald-500" />
                  Webhooks Configured
                </>
              ) : (
                <>
                  <Webhook className="mr-2 h-3 w-3" />
                  Setup Webhooks
                </>
              )}
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
