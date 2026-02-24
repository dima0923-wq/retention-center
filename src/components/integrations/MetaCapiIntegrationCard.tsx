"use client";

import { useState, useEffect } from "react";
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
import { Megaphone, Loader2 } from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus";
import { toast } from "sonner";

export function MetaCapiIntegrationCard() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/meta-capi")
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

  const updateField = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!config.pixelId || !config.accessToken) {
      toast.error("Pixel ID and Access Token are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "meta_capi",
          type: "META_CAPI",
          config,
          isActive: true,
        }),
      });
      if (res.ok) {
        setIsActive(true);
        toast.success("Meta CAPI configuration saved");
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

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/meta-capi/test", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Meta CAPI connection successful");
      } else {
        toast.error(data.error ?? "Connection test failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setTesting(false);
    }
  };

  const handleDeactivate = async () => {
    const res = await fetch("/api/integrations/meta_capi", {
      method: "DELETE",
    });
    if (res.ok) {
      setIsActive(false);
      toast.success("Meta CAPI deactivated");
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
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Meta CAPI</CardTitle>
            <CardDescription className="text-xs">
              Send conversion events to Meta via Conversions API
            </CardDescription>
          </div>
        </div>
        <ConnectionStatus status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pixel ID */}
        <div className="space-y-1.5">
          <Label htmlFor="meta-pixelId" className="text-xs">
            Pixel ID
          </Label>
          <Input
            id="meta-pixelId"
            type="text"
            placeholder="Your Meta Pixel ID"
            value={config.pixelId ?? ""}
            onChange={(e) => updateField("pixelId", e.target.value)}
          />
        </div>

        {/* Access Token */}
        <div className="space-y-1.5">
          <Label htmlFor="meta-accessToken" className="text-xs">
            Access Token
          </Label>
          <Input
            id="meta-accessToken"
            type="password"
            placeholder="Your Meta CAPI access token"
            value={config.accessToken ?? ""}
            onChange={(e) => updateField("accessToken", e.target.value)}
          />
        </div>

        {/* Test Event Code (optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="meta-testEventCode" className="text-xs">
            Test Event Code{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="meta-testEventCode"
            type="text"
            placeholder="TEST12345"
            value={config.testEventCode ?? ""}
            onChange={(e) => updateField("testEventCode", e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          {isActive && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing}
              >
                {testing && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Test Connection
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDeactivate}>
                Deactivate
              </Button>
            </>
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
