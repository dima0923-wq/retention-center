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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Loader2 } from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus";
import { TestConnectionButton } from "./TestConnectionButton";
import { WebhookUrlDisplay } from "./WebhookUrlDisplay";
import { toast } from "sonner";

type Assistant = {
  id: string;
  name: string;
};

type PhoneNumber = {
  id: string;
  number: string;
  provider?: string;
};

export function VapiIntegrationCard() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  // Dropdown data
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loadingAssistants, setLoadingAssistants] = useState(false);
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(false);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const fetchDropdowns = useCallback(async () => {
    setLoadingAssistants(true);
    setLoadingPhoneNumbers(true);
    try {
      const [aRes, pRes] = await Promise.all([
        fetch("/api/integrations/vapi/assistants"),
        fetch("/api/integrations/vapi/phone-numbers"),
      ]);
      if (aRes.ok) {
        const data = await aRes.json();
        setAssistants(Array.isArray(data) ? data : (data.assistants ?? []));
      }
      if (pRes.ok) {
        const data = await pRes.json();
        setPhoneNumbers(Array.isArray(data) ? data : (data.phoneNumbers ?? []));
      }
    } catch {
      // Supplementary — fail silently
    } finally {
      setLoadingAssistants(false);
      setLoadingPhoneNumbers(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/integrations/vapi")
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
            setConnectionOk(data.isActive ? true : null);
          } catch {
            // malformed config — ignore
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchDropdowns();
    }
  }, [isActive, fetchDropdowns]);

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
          provider: "vapi",
          type: "CALL",
          config,
          isActive: true,
        }),
      });
      if (res.ok) {
        setIsActive(true);
        toast.success("VAPI configuration saved");
        fetchDropdowns();
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
    const res = await fetch("/api/integrations/vapi", { method: "DELETE" });
    if (res.ok) {
      setIsActive(false);
      setConnectionOk(null);
      setAssistants([]);
      setPhoneNumbers([]);
      toast.success("VAPI deactivated");
    }
  };

  const status = loading
    ? "testing"
    : isActive && connectionOk
      ? "connected"
      : "disconnected";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">VAPI AI</CardTitle>
            <CardDescription className="text-xs">
              AI-powered voice calls for lead outreach
            </CardDescription>
          </div>
        </div>
        <ConnectionStatus status={status} />
      </CardHeader>

      <CardContent className="space-y-4">
        {/* API Key */}
        <div className="space-y-1.5">
          <Label htmlFor="vapi-apiKey" className="text-xs">
            API Key
          </Label>
          <Input
            id="vapi-apiKey"
            type="password"
            placeholder="sk-..."
            value={config.apiKey ?? ""}
            onChange={(e) => updateField("apiKey", e.target.value)}
          />
        </div>

        {/* Default Assistant */}
        <div className="space-y-1.5">
          <Label className="text-xs">Default Assistant</Label>
          {isActive && assistants.length > 0 ? (
            <Select
              value={config.assistantId || undefined}
              onValueChange={(val) => updateField("assistantId", val)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={loadingAssistants ? "Loading..." : "Select assistant"} />
              </SelectTrigger>
              <SelectContent>
                {assistants.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="vapi-assistantId"
              type="text"
              placeholder={
                isActive && loadingAssistants
                  ? "Loading assistants..."
                  : "Assistant ID (save API key first)"
              }
              value={config.assistantId ?? ""}
              onChange={(e) => updateField("assistantId", e.target.value)}
            />
          )}
        </div>

        {/* Default Phone Number */}
        <div className="space-y-1.5">
          <Label className="text-xs">Default Phone Number</Label>
          {isActive && phoneNumbers.length > 0 ? (
            <Select
              value={config.phoneNumberId || undefined}
              onValueChange={(val) => updateField("phoneNumberId", val)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={loadingPhoneNumbers ? "Loading..." : "Select phone number"} />
              </SelectTrigger>
              <SelectContent>
                {phoneNumbers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span>{p.number}</span>
                    {p.provider && (
                      <Badge variant="secondary" className="ml-2 text-xs font-normal">
                        {p.provider}
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="vapi-phoneNumberId"
              type="text"
              placeholder={
                isActive && loadingPhoneNumbers
                  ? "Loading phone numbers..."
                  : "Phone Number ID (save API key first)"
              }
              value={config.phoneNumberId ?? ""}
              onChange={(e) => updateField("phoneNumberId", e.target.value)}
            />
          )}
        </div>

        {/* Webhook URL */}
        <WebhookUrlDisplay
          label="Webhook URL"
          url={`${baseUrl}/api/webhooks/vapi`}
        />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <TestConnectionButton provider="vapi" onResult={setConnectionOk} />
          <div className="flex gap-2">
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
        </div>
      </CardContent>
    </Card>
  );
}
