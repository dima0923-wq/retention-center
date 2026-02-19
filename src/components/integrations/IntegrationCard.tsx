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
import { Loader2 } from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus";
import { TestConnectionButton } from "./TestConnectionButton";
import { WebhookUrlDisplay } from "./WebhookUrlDisplay";
import { toast } from "sonner";

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "password";
  placeholder?: string;
};

type Props = {
  provider: string;
  type: "CALL" | "SMS" | "EMAIL";
  title: string;
  description: string;
  icon: React.ReactNode;
  fields: FieldDef[];
  webhookUrl?: string;
};

export function IntegrationCard({
  provider,
  type,
  title,
  description,
  icon,
  fields,
  webhookUrl,
}: Props) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`/api/integrations/${provider}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.config) {
          setConfig(data.config as Record<string, string>);
          setIsActive(data.isActive);
          setConnectionOk(data.isActive ? true : null);
        }
      })
      .finally(() => setLoading(false));
  }, [provider]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, type, config, isActive: true }),
      });
      if (res.ok) {
        setIsActive(true);
        toast.success(`${title} configuration saved`);
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save");
      }
    } catch {
      toast.error("Network error");
    }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    const res = await fetch(`/api/integrations/${provider}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setIsActive(false);
      setConnectionOk(null);
      toast.success(`${title} deactivated`);
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
            {icon}
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
        <ConnectionStatus status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`${provider}-${field.key}`} className="text-xs">
              {field.label}
            </Label>
            <Input
              id={`${provider}-${field.key}`}
              type={field.type ?? "text"}
              placeholder={field.placeholder}
              value={config[field.key] ?? ""}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
            />
          </div>
        ))}

        {webhookUrl && (
          <WebhookUrlDisplay label="Webhook URL" url={webhookUrl} />
        )}

        <div className="flex items-center justify-between pt-2">
          <TestConnectionButton
            provider={provider}
            onResult={setConnectionOk}
          />
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
